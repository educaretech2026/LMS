"use client";

import React, { useEffect, useRef, useCallback, memo } from "react";
import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import { fetchApi } from "@/lib/api";
import { safePublishData } from "./livekit-room-v2";

interface SynchronizedWhiteboardProps {
  isTeacher: boolean;
  allowStudentDraw: boolean;
  room: any;
  classId?: string;
}

function isDocRecord(record: any) {
  if (!record || typeof record !== "object") return false;
  const t = record.typeName;
  return t === "shape" || t === "asset" || t === "binding";
}

export const SynchronizedWhiteboard = memo(function SynchronizedWhiteboard({
  isTeacher,
  allowStudentDraw,
  room,
  classId,
}: SynchronizedWhiteboardProps) {
  const editorRef = useRef<any>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const flushIntervalRef = useRef<any>(null);

  const pendingDeltasQueue = useRef<{
    added: Record<string, any>;
    updated: Record<string, any>;
    removed: Record<string, any>;
  }>({ added: {}, updated: {}, removed: {} });

  // Periodic delta transmitter (every 80ms)
  const flushPendingDeltas = useCallback(() => {
    if (!room || room.state !== "connected") return;
    const canDraw = isTeacher || allowStudentDraw;
    if (!canDraw) return;

    const batch = {
      added: { ...pendingDeltasQueue.current.added },
      updated: { ...pendingDeltasQueue.current.updated },
      removed: { ...pendingDeltasQueue.current.removed },
    };

    const addedKeys = Object.keys(batch.added);
    const updatedKeys = Object.keys(batch.updated);
    const removedKeys = Object.keys(batch.removed);

    if (addedKeys.length === 0 && updatedKeys.length === 0 && removedKeys.length === 0) {
      return;
    }

    pendingDeltasQueue.current = { added: {}, updated: {}, removed: {} };

    try {
      const CHUNK_SIZE = 12;
      const chunks: { added: any; updated: any; removed: any }[] = [];
      let curChunk: { added: any; updated: any; removed: any } = { added: {}, updated: {}, removed: {} };
      let curCount = 0;

      for (const k of addedKeys) {
        curChunk.added[k] = batch.added[k];
        curCount++;
        if (curCount >= CHUNK_SIZE) {
          chunks.push(curChunk);
          curChunk = { added: {}, updated: {}, removed: {} };
          curCount = 0;
        }
      }

      for (const k of updatedKeys) {
        curChunk.updated[k] = batch.updated[k];
        curCount++;
        if (curCount >= CHUNK_SIZE) {
          chunks.push(curChunk);
          curChunk = { added: {}, updated: {}, removed: {} };
          curCount = 0;
        }
      }

      for (const k of removedKeys) {
        curChunk.removed[k] = batch.removed[k];
        curCount++;
        if (curCount >= CHUNK_SIZE) {
          chunks.push(curChunk);
          curChunk = { added: {}, updated: {}, removed: {} };
          curCount = 0;
        }
      }

      if (curCount > 0) {
        chunks.push(curChunk);
      }

      for (const ch of chunks) {
        safePublishData(room, {
          type: "WHITEBOARD_DELTA",
          changes: ch,
        });
      }
    } catch (err) {
      console.warn("Whiteboard delta flush error:", err);
    }
  }, [room, isTeacher, allowStudentDraw]);

  useEffect(() => {
    flushIntervalRef.current = setInterval(flushPendingDeltas, 80);
    return () => {
      if (flushIntervalRef.current) clearInterval(flushIntervalRef.current);
      flushPendingDeltas();
    };
  }, [flushPendingDeltas]);

  // Handle incoming whiteboard delta packets from remote participants
  useEffect(() => {
    if (!room) return;

    const handleData = (payload: Uint8Array) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        if (data.type === "WHITEBOARD_DELTA" && data.changes) {
          const editor = editorRef.current;
          if (!editor) return;

          const ch = data.changes;
          editor.store.mergeRemoteChanges(() => {
            if (ch.added && Object.keys(ch.added).length > 0) {
              editor.store.put(Object.values(ch.added));
            }
            if (ch.updated && Object.keys(ch.updated).length > 0) {
              const toRecords = Object.values(ch.updated).map((u: any) =>
                Array.isArray(u) ? u[1] : u
              );
              editor.store.put(toRecords);
            }
            if (ch.removed && Object.keys(ch.removed).length > 0) {
              editor.store.remove(Object.keys(ch.removed));
            }
          });
        } else if (data.type === "WHITEBOARD_CLEAR") {
          const editor = editorRef.current;
          if (!editor) return;

          editor.store.mergeRemoteChanges(() => {
            const shapeIds = editor.store
              .allRecords()
              .filter((r: any) => r.typeName === "shape")
              .map((r: any) => r.id);
            if (shapeIds.length > 0) editor.store.remove(shapeIds);
          });
        }
      } catch {}
    };

    room.on("dataReceived", handleData);
    return () => {
      room.off("dataReceived", handleData);
    };
  }, [room]);

  const handleMount = useCallback(
    (editor: any) => {
      editorRef.current = editor;

      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }

      const canDraw = isTeacher || allowStudentDraw;
      editor.updateInstanceState({ isReadonly: !canDraw });

      // Listen for local changes to transmit
      unsubRef.current = editor.store.listen(
        (entry: any) => {
          if (entry.source !== "user") return;
          const canUserDraw = isTeacher || allowStudentDraw;
          if (!canUserDraw) return;

          const { added, updated, removed } = entry.changes;

          if (added) {
            for (const [id, r] of Object.entries(added)) {
              if (isDocRecord(r)) pendingDeltasQueue.current.added[id] = r;
            }
          }
          if (updated) {
            for (const [id, r] of Object.entries(updated)) {
              const rec = Array.isArray(r) ? r[1] : r;
              if (isDocRecord(rec)) pendingDeltasQueue.current.updated[id] = r;
            }
          }
          if (removed) {
            for (const [id, r] of Object.entries(removed)) {
              if (isDocRecord(r)) pendingDeltasQueue.current.removed[id] = r;
            }
          }
        },
        { scope: "document", source: "user" }
      );

      // Load initial snapshot from server if classId is present
      if (classId) {
        fetchApi<any>(`/live-class/${classId}/whiteboard-snapshot`, { silent: true })
          .then((data) => {
            if (data && editorRef.current) {
              try {
                if (Array.isArray(data)) {
                  editorRef.current.store.put(data);
                } else if (typeof data === "object") {
                  const records = Object.values(data).filter(isDocRecord);
                  if (records.length > 0) {
                    editorRef.current.store.put(records);
                  }
                }
              } catch (loadErr) {
                console.warn("Could not load initial whiteboard snapshot:", loadErr);
              }
            }
          })
          .catch(() => {});
      }

      setTimeout(() => {
        try {
          editor.updateViewportScreenBounds();
        } catch {}
      }, 100);
    },
    [isTeacher, allowStudentDraw, classId]
  );

  // Periodic background persistence for host/presenter
  useEffect(() => {
    if (!isTeacher || !classId) return;
    const interval = setInterval(() => {
      const editor = editorRef.current;
      if (!editor) return;
      try {
        const records = editor.store.allRecords().filter(isDocRecord);
        if (records.length > 0) {
          fetchApi(`/live-class/${classId}/whiteboard-snapshot`, {
            method: "POST",
            body: JSON.stringify({ snapshot: records }),
            silent: true,
          }).catch(() => {});
        }
      } catch {}
    }, 15000);

    return () => {
      clearInterval(interval);
      // Final flush on unmount
      const editor = editorRef.current;
      if (editor) {
        try {
          const records = editor.store.allRecords().filter(isDocRecord);
          if (records.length > 0) {
            fetchApi(`/live-class/${classId}/whiteboard-snapshot`, {
              method: "POST",
              body: JSON.stringify({ snapshot: records }),
              silent: true,
            }).catch(() => {});
          }
        } catch {}
      }
    };
  }, [isTeacher, classId]);

  useEffect(() => {
    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, []);

  // Dynamically update readonly mode when teacher toggles student permission
  useEffect(() => {
    if (editorRef.current) {
      const canDraw = isTeacher || allowStudentDraw;
      editorRef.current.updateInstanceState({ isReadonly: !canDraw });
    }
  }, [isTeacher, allowStudentDraw]);

  return (
    <div className="h-full w-full relative">
      <Tldraw onMount={handleMount} />
      {!isTeacher && !allowStudentDraw && (
        <div className="absolute top-3 left-16 z-30 pointer-events-none bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white/80 text-[11px] font-semibold flex items-center gap-1.5 shadow-lg">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span>View Only (Drawing Locked by Teacher)</span>
        </div>
      )}
    </div>
  );
});

