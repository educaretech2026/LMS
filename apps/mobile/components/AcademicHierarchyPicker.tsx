import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { GitBranch, ChevronRight, CheckCircle2, X, SlidersHorizontal } from 'lucide-react-native';
import { fetchApi } from '../lib/api';
import { Colors, Radii, Shadows } from '../lib/theme';

export interface AcademicHierarchyValue {
  centreId?: string;
  centreName?: string;
  boardId?: string;
  boardName?: string;
  standardId?: string;
  standardName?: string;
  subjectId?: string;
  subjectName?: string;
  batchId?: string;
  batchName?: string;
  syllabusId?: string;
}

interface Props {
  value: AcademicHierarchyValue;
  onChange: (value: AcademicHierarchyValue) => void;
  showCentre?: boolean;
  showBoard?: boolean;
  showStandard?: boolean;
  showSubject?: boolean;
  showBatch?: boolean;
  label?: string;
  required?: boolean;
  compact?: boolean;
}

interface Item {
  id: string;
  name: string;
  code?: string;
  [key: string]: any;
}

export function AcademicHierarchyPicker({
  value,
  onChange,
  showCentre = true,
  showBoard = true,
  showStandard = true,
  showSubject = true,
  showBatch = true,
  label = 'Academic Hierarchy',
  required = false,
  compact = false,
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<'centre' | 'board' | 'standard' | 'subject' | 'batch'>('centre');
  const [loading, setLoading] = useState(false);

  // Data lists
  const [centres, setCentres] = useState<Item[]>([]);
  const [boards, setBoards] = useState<Item[]>([]);
  const [standards, setStandards] = useState<Item[]>([]);
  const [subjects, setSubjects] = useState<Item[]>([]);
  const [batches, setBatches] = useState<Item[]>([]);
  const [syllabi, setSyllabi] = useState<any[]>([]);

  // Initial load of centres and boards
  useEffect(() => {
    let isMounted = true;
    async function loadInitial() {
      try {
        setLoading(true);
        const [cList, bList, sList] = await Promise.all([
          showCentre ? fetchApi<Item[]>('/setup/centres').catch(() => []) : Promise.resolve([]),
          showBoard ? fetchApi<Item[]>('/setup/boards').catch(() => []) : Promise.resolve([]),
          showSubject ? fetchApi<Item[]>('/setup/subjects').catch(() => []) : Promise.resolve([]),
        ]);
        if (isMounted) {
          setCentres(Array.isArray(cList) ? cList : []);
          setBoards(Array.isArray(bList) ? bList : []);
          setSubjects(Array.isArray(sList) ? sList : []);
        }
      } catch (err) {
        // Handled silently
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadInitial();
    return () => { isMounted = false; };
  }, [showCentre, showBoard, showSubject]);

  // Load standards when boardId changes
  useEffect(() => {
    if (!showStandard) return;
    let isMounted = true;
    async function loadStandards() {
      try {
        const query = value.boardId ? `?boardId=${value.boardId}` : '';
        const stdList = await fetchApi<Item[]>(`/setup/standards${query}`).catch(() => []);
        if (isMounted) {
          setStandards(Array.isArray(stdList) ? stdList : []);
        }
      } catch (err) {
        // Handled
      }
    }
    loadStandards();
    return () => { isMounted = false; };
  }, [value.boardId, showStandard]);

  // Load batches when boardId or standardId changes
  useEffect(() => {
    if (!showBatch) return;
    let isMounted = true;
    async function loadBatches() {
      try {
        const params = new URLSearchParams();
        if (value.boardId) params.append('boardId', value.boardId);
        if (value.standardId) params.append('standardId', value.standardId);
        const bList = await fetchApi<Item[]>(`/setup/batches?${params.toString()}`).catch(() => []);
        if (isMounted) {
          setBatches(Array.isArray(bList) ? bList : []);
        }
      } catch (err) {
        // Handled
      }
    }
    loadBatches();
    return () => { isMounted = false; };
  }, [value.boardId, value.standardId, showBatch]);

  // Load syllabi when boardId & standardId change to resolve subject & syllabusId
  useEffect(() => {
    if (!value.boardId || !value.standardId) return;
    let isMounted = true;
    async function loadSyllabi() {
      try {
        const sylList = await fetchApi<any[]>(
          `/setup/syllabi?boardId=${value.boardId}&standardId=${value.standardId}`
        ).catch(() => []);
        if (isMounted) {
          setSyllabi(Array.isArray(sylList) ? sylList : []);
        }
      } catch (err) {
        // Handled
      }
    }
    loadSyllabi();
    return () => { isMounted = false; };
  }, [value.boardId, value.standardId]);

  // Filter batches by centreId if selected
  const filteredBatches = useMemo(() => {
    if (!value.centreId) return batches;
    return batches.filter(b => !b.centreId || b.centreId === value.centreId);
  }, [batches, value.centreId]);

  // Available subjects for the board/class (or fallback to all subjects)
  const availableSubjects = useMemo(() => {
    if (syllabi.length > 0) {
      return syllabi
        .map(s => ({
          id: s.subjectId || s.subject?.id,
          name: s.subject?.name || 'Unknown',
          code: s.subject?.code,
          syllabusId: s.id,
        }))
        .filter(s => s.id);
    }
    return subjects;
  }, [syllabi, subjects]);

  // Available tabs
  const tabs = useMemo(() => {
    const list: { key: 'centre' | 'board' | 'standard' | 'subject' | 'batch'; label: string; current?: string }[] = [];
    if (showCentre) list.push({ key: 'centre', label: 'Centre', current: value.centreName });
    if (showBoard) list.push({ key: 'board', label: 'Board', current: value.boardName });
    if (showStandard) list.push({ key: 'standard', label: 'Class', current: value.standardName });
    if (showSubject) list.push({ key: 'subject', label: 'Subject', current: value.subjectName });
    if (showBatch) list.push({ key: 'batch', label: 'Batch', current: value.batchName });
    return list;
  }, [showCentre, showBoard, showStandard, showSubject, showBatch, value]);

  // Summary breadcrumb segments
  const breadcrumb = useMemo(() => {
    const parts: string[] = [];
    if (showCentre && value.centreName) parts.push(value.centreName);
    if (showBoard && value.boardName) parts.push(value.boardName);
    if (showStandard && value.standardName) parts.push(value.standardName);
    if (showSubject && value.subjectName) parts.push(value.subjectName);
    if (showBatch && value.batchName) parts.push(value.batchName);
    return parts;
  }, [showCentre, showBoard, showStandard, showSubject, showBatch, value]);

  const handleSelectCentre = (c: Item) => {
    onChange({
      ...value,
      centreId: c.id,
      centreName: c.name,
      // If batch doesn't match new centre, reset batch
      batchId: undefined,
      batchName: undefined,
    });
    if (showBoard) setActiveTab('board');
  };

  const handleSelectBoard = (b: Item) => {
    onChange({
      ...value,
      boardId: b.id,
      boardName: b.name,
      standardId: undefined,
      standardName: undefined,
      batchId: undefined,
      batchName: undefined,
      syllabusId: undefined,
    });
    if (showStandard) setActiveTab('standard');
  };

  const handleSelectStandard = (s: Item) => {
    onChange({
      ...value,
      standardId: s.id,
      standardName: s.name,
      batchId: undefined,
      batchName: undefined,
      syllabusId: undefined,
    });
    if (showSubject) setActiveTab('subject');
    else if (showBatch) setActiveTab('batch');
  };

  const handleSelectSubject = (s: Item) => {
    const matchedSyllabus = syllabi.find(syl => syl.subjectId === s.id || syl.subject?.id === s.id);
    onChange({
      ...value,
      subjectId: s.id,
      subjectName: s.name,
      syllabusId: matchedSyllabus ? matchedSyllabus.id : s.syllabusId,
    });
    if (showBatch) setActiveTab('batch');
  };

  const handleSelectBatch = (b: Item) => {
    onChange({
      ...value,
      batchId: b.id,
      batchName: b.name,
      // Infer centre/board/standard if batch has them populated
      centreId: value.centreId || b.centreId,
      centreName: value.centreName || (typeof b.centre === 'object' ? b.centre?.name : undefined),
      boardId: value.boardId || b.boardId,
      boardName: value.boardName || (typeof b.board === 'object' ? b.board?.name : undefined),
      standardId: value.standardId || b.standardId,
      standardName: value.standardName || (typeof b.standard === 'object' ? b.standard?.name : undefined),
    });
    setModalVisible(false);
  };

  const handleClear = () => {
    onChange({});
  };

  return (
    <View style={styles.container}>
      {/* Label and Clear action */}
      <View style={styles.labelRow}>
        <View style={styles.labelLeft}>
          <GitBranch size={14} color={Colors.brand.blue} />
          <Text style={styles.labelText}>
            {label} {required && <Text style={{ color: Colors.brand.red }}>*</Text>}
          </Text>
        </View>
        {breadcrumb.length > 0 && (
          <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Trigger Button / Breadcrumb Card */}
      <TouchableOpacity
        style={[
          styles.triggerCard,
          breadcrumb.length === 0 && required && styles.triggerRequired,
        ]}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        {breadcrumb.length === 0 ? (
          <View style={styles.placeholderRow}>
            <Text style={styles.placeholderText}>
              Select {tabs.map(t => t.label).join(' → ')}
            </Text>
            <ChevronRight size={16} color={Colors.text.muted} />
          </View>
        ) : (
          <View style={styles.breadcrumbWrapper}>
            <View style={styles.chipsRow}>
              {breadcrumb.map((seg, idx) => (
                <View key={idx} style={styles.chipItem}>
                  <View style={styles.chip}>
                    <Text style={styles.chipText} numberOfLines={1}>{seg}</Text>
                  </View>
                  {idx < breadcrumb.length - 1 && (
                    <Text style={styles.arrowText}>›</Text>
                  )}
                </View>
              ))}
            </View>
            <View style={styles.editRow}>
              <SlidersHorizontal size={14} color={Colors.brand.blue} />
              <Text style={styles.editText}>Edit</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      {/* Selection Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Academic Hierarchy</Text>
                <Text style={styles.modalSubtitle}>Institutional cascading structure</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
              >
                <X size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Stepper Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.tabsScroll}
              contentContainerStyle={styles.tabsContent}
            >
              {tabs.map((tab, idx) => {
                const isActive = activeTab === tab.key;
                const isSelected = !!tab.current;
                return (
                  <TouchableOpacity
                    key={tab.key}
                    style={[
                      styles.tabPill,
                      isActive && styles.tabPillActive,
                      isSelected && !isActive && styles.tabPillFilled,
                    ]}
                    onPress={() => setActiveTab(tab.key)}
                  >
                    <Text
                      style={[
                        styles.tabIndex,
                        isActive && styles.tabIndexActive,
                        isSelected && !isActive && styles.tabIndexFilled,
                      ]}
                    >
                      {idx + 1}
                    </Text>
                    <View>
                      <Text
                        style={[
                          styles.tabLabel,
                          isActive && styles.tabLabelActive,
                          isSelected && !isActive && styles.tabLabelFilled,
                        ]}
                      >
                        {tab.label}
                      </Text>
                      {tab.current ? (
                        <Text style={styles.tabCurrent} numberOfLines={1}>
                          {tab.current}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* List for Active Tab */}
            <View style={styles.listContainer}>
              {loading ? (
                <View style={styles.loaderWrap}>
                  <ActivityIndicator size="small" color={Colors.brand.blue} />
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* CENTRE TAB */}
                  {activeTab === 'centre' && (
                    <View style={styles.itemsGrid}>
                      {centres.map(c => {
                        const sel = value.centreId === c.id;
                        return (
                          <TouchableOpacity
                            key={c.id}
                            style={[styles.itemCard, sel && styles.itemCardSelected]}
                            onPress={() => handleSelectCentre(c)}
                          >
                            <View style={styles.itemTextWrap}>
                              <Text style={[styles.itemTitle, sel && styles.itemTitleSelected]}>
                                {c.name}
                              </Text>
                              {c.code ? <Text style={styles.itemMeta}>{c.code}</Text> : null}
                            </View>
                            {sel && (
                              <CheckCircle2 size={18} color={Colors.brand.blue} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                      {centres.length === 0 && (
                        <Text style={styles.emptyMsg}>No centres configured.</Text>
                      )}
                    </View>
                  )}

                  {/* BOARD TAB */}
                  {activeTab === 'board' && (
                    <View style={styles.itemsGrid}>
                      {boards.map(b => {
                        const sel = value.boardId === b.id;
                        return (
                          <TouchableOpacity
                            key={b.id}
                            style={[styles.itemCard, sel && styles.itemCardSelected]}
                            onPress={() => handleSelectBoard(b)}
                          >
                            <View style={styles.itemTextWrap}>
                              <Text style={[styles.itemTitle, sel && styles.itemTitleSelected]}>
                                {b.name}
                              </Text>
                            </View>
                            {sel && (
                              <CheckCircle2 size={18} color={Colors.brand.blue} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                      {boards.length === 0 && (
                        <Text style={styles.emptyMsg}>No boards configured.</Text>
                      )}
                    </View>
                  )}

                  {/* STANDARD / CLASS TAB */}
                  {activeTab === 'standard' && (
                    <View style={styles.itemsGrid}>
                      {standards.map(s => {
                        const sel = value.standardId === s.id;
                        return (
                          <TouchableOpacity
                            key={s.id}
                            style={[styles.itemCard, sel && styles.itemCardSelected]}
                            onPress={() => handleSelectStandard(s)}
                          >
                            <View style={styles.itemTextWrap}>
                              <Text style={[styles.itemTitle, sel && styles.itemTitleSelected]}>
                                {s.name}
                              </Text>
                              {s.level !== undefined ? (
                                <Text style={styles.itemMeta}>Level {s.level}</Text>
                              ) : null}
                            </View>
                            {sel && (
                              <CheckCircle2 size={18} color={Colors.brand.blue} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                      {standards.length === 0 && (
                        <Text style={styles.emptyMsg}>
                          {value.boardId ? 'No classes found for this board.' : 'Please select a board first.'}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* SUBJECT TAB */}
                  {activeTab === 'subject' && (
                    <View style={styles.itemsGrid}>
                      {availableSubjects.map(s => {
                        const sel = value.subjectId === s.id;
                        return (
                          <TouchableOpacity
                            key={s.id}
                            style={[styles.itemCard, sel && styles.itemCardSelected]}
                            onPress={() => handleSelectSubject(s)}
                          >
                            <View style={styles.itemTextWrap}>
                              <Text style={[styles.itemTitle, sel && styles.itemTitleSelected]}>
                                {s.name}
                              </Text>
                              {s.code ? <Text style={styles.itemMeta}>{s.code}</Text> : null}
                            </View>
                            {sel && (
                              <CheckCircle2 size={18} color={Colors.brand.blue} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                      {availableSubjects.length === 0 && (
                        <Text style={styles.emptyMsg}>No subjects found.</Text>
                      )}
                    </View>
                  )}

                  {/* BATCH TAB */}
                  {activeTab === 'batch' && (
                    <View style={styles.itemsGrid}>
                      {filteredBatches.map(b => {
                        const sel = value.batchId === b.id;
                        return (
                          <TouchableOpacity
                            key={b.id}
                            style={[styles.itemCard, sel && styles.itemCardSelected]}
                            onPress={() => handleSelectBatch(b)}
                          >
                            <View style={styles.itemTextWrap}>
                              <Text style={[styles.itemTitle, sel && styles.itemTitleSelected]}>
                                {b.name}
                              </Text>
                              <Text style={styles.itemMeta}>
                                {[
                                  typeof b.centre === 'object' ? b.centre?.name : null,
                                  typeof b.board === 'object' ? b.board?.name : null,
                                  typeof b.standard === 'object' ? b.standard?.name : null,
                                ].filter(Boolean).join(' • ')}
                              </Text>
                            </View>
                            {sel && (
                              <CheckCircle2 size={18} color={Colors.brand.blue} />
                            )}
                          </TouchableOpacity>
                        );
                      })}
                      {filteredBatches.length === 0 && (
                        <Text style={styles.emptyMsg}>
                          {value.standardId ? 'No batches found for this class.' : 'Select Board & Class to view batches.'}
                        </Text>
                      )}
                    </View>
                  )}
                </ScrollView>
              )}
            </View>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.doneBtnText}>Confirm Selection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  clearText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.brand.red,
  },
  triggerCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: Radii.lg,
    borderWidth: 1,
    borderColor: Colors.border.default,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 46,
    justifyContent: 'center',
  },
  triggerRequired: {
    borderColor: 'rgba(238,27,36,0.35)',
  },
  placeholderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 12,
    color: Colors.text.muted,
  },
  breadcrumbWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  chipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chip: {
    backgroundColor: 'rgba(1,98,177,0.08)',
    borderRadius: Radii.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(1,98,177,0.2)',
    maxWidth: 110,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.brand.blue,
  },
  arrowText: {
    fontSize: 11,
    color: Colors.text.muted,
    fontWeight: '600',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
  },
  editText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.brand.blue,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface.card,
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    maxHeight: '85%',
    minHeight: '65%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  modalSubtitle: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radii.full,
    backgroundColor: Colors.surface.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stepper tabs
  tabsScroll: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.default,
    maxHeight: 58,
  },
  tabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radii.md,
    backgroundColor: Colors.surface.subtle,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  tabPillActive: {
    backgroundColor: 'rgba(1,98,177,0.12)',
    borderColor: Colors.brand.blue,
  },
  tabPillFilled: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(1,98,177,0.3)',
  },
  tabIndex: {
    width: 18,
    height: 18,
    borderRadius: Radii.full,
    backgroundColor: Colors.border.default,
    color: Colors.text.secondary,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 18,
  },
  tabIndexActive: {
    backgroundColor: Colors.brand.blue,
    color: '#FFFFFF',
  },
  tabIndexFilled: {
    backgroundColor: 'rgba(1,98,177,0.2)',
    color: Colors.brand.blue,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  tabLabelActive: {
    color: Colors.brand.blue,
    fontWeight: '700',
  },
  tabLabelFilled: {
    color: Colors.text.primary,
  },
  tabCurrent: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.brand.blue,
    maxWidth: 90,
  },

  // List
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  loaderWrap: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  itemsGrid: {
    gap: 8,
    paddingBottom: 20,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radii.md,
    backgroundColor: Colors.surface.subtle,
    borderWidth: 1,
    borderColor: Colors.border.default,
  },
  itemCardSelected: {
    backgroundColor: 'rgba(1,98,177,0.08)',
    borderColor: Colors.brand.blue,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  itemTitleSelected: {
    color: Colors.brand.blue,
    fontWeight: '700',
  },
  itemMeta: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  emptyMsg: {
    fontSize: 12,
    color: Colors.text.muted,
    textAlign: 'center',
    paddingVertical: 24,
  },

  // Footer
  modalFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border.default,
  },
  doneBtn: {
    backgroundColor: Colors.brand.blue,
    borderRadius: Radii.lg,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
