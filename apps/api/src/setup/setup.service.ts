import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, Optional } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { isSuperAdmin, getAuthorizedCentreIds, assertCentreAccess } from '../common/utils/tenant.util';

import { StorageService } from '../storage/storage.service';
import { MODULE_PERMISSIONS } from '../common/constants/permissions.constant';

@Injectable()
export class SetupService {

  constructor(
    private prisma: PrismaService,
    @Optional() private storageService?: StorageService,
  ) {}

  // Roles
  async getRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } }
      }
    });
  }
  
  async createRole(data: { name: string }) {
    return this.prisma.role.create({ data });
  }

  async deleteRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } }
    });
    if (!role) throw new NotFoundException('Role not found');
    if (role._count.users > 0) {
      throw new ConflictException(`Cannot delete: Found ${role._count.users} users attached to this role.`);
    }
    // Protect system roles
    if (['SUPER_ADMIN', 'CENTRE_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC_LEARNER'].includes(role.name)) {
       throw new ConflictException('Cannot delete system role.');
    }
    return this.prisma.role.delete({ where: { id } });
  }

  async toggleRolePermission(roleId: string, moduleName: string, active: boolean) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.name === 'SUPER_ADMIN') {
      throw new BadRequestException('Cannot modify permissions for SUPER_ADMIN');
    }

    // Resolve canonical definition and aliases
    const def = MODULE_PERMISSIONS.find(
      m => m.key === moduleName.toUpperCase() || m.label.toLowerCase() === moduleName.toLowerCase()
    );
    const canonicalKey = def ? def.key : moduleName;
    const allMatchingActions = [
      canonicalKey,
      moduleName,
      ...(def ? [def.label, ...def.aliases] : [])
    ];

    // Find any existing permission records matching these actions
    const existingPerms = await this.prisma.permission.findMany({
      where: { action: { in: allMatchingActions } },
    });

    if (active) {
      // Ensure canonical permission exists in database
      let canonicalPerm = existingPerms.find(p => p.action === canonicalKey);
      if (!canonicalPerm) {
        canonicalPerm = await this.prisma.permission.upsert({
          where: { action: canonicalKey },
          create: { action: canonicalKey, description: def?.description || canonicalKey },
          update: {},
        });
      }

      await this.prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: canonicalPerm.id } },
        create: { roleId, permissionId: canonicalPerm.id },
        update: {},
      });
    } else {
      // Deactivate: remove canonical and any legacy alias relations
      if (existingPerms.length > 0) {
        await this.prisma.rolePermission.deleteMany({
          where: {
            roleId,
            permissionId: { in: existingPerms.map(p => p.id) },
          },
        });
      }
    }
    return { success: true };
  }

  async bulkSetRolePermissions(roleId: string, moduleKeys: string[]) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.name === 'SUPER_ADMIN') {
      throw new BadRequestException('Cannot modify permissions for SUPER_ADMIN');
    }

    // Delete all current permissions for this role
    await this.prisma.rolePermission.deleteMany({ where: { roleId } });

    // Add selected permissions
    for (const key of moduleKeys) {
      const def = MODULE_PERMISSIONS.find(m => m.key === key.toUpperCase());
      const canonicalKey = def ? def.key : key;

      const perm = await this.prisma.permission.upsert({
        where: { action: canonicalKey },
        create: { action: canonicalKey, description: def?.description || canonicalKey },
        update: {},
      });

      await this.prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: perm.id } },
        create: { roleId, permissionId: perm.id },
        update: {},
      });
    }

    return { success: true };
  }

  // Centres
  async getCentres() {
    return this.prisma.centre.findMany();
  }
  async createCentre(data: { name: string; code: string; type?: string; address?: string; contactNo?: string; email?: string }) {
    try {
      return await this.prisma.centre.create({ 
        data: {
          name: data.name,
          code: data.code,
          address: data.address,
          contactNo: data.contactNo,
          email: data.email
        } 
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException('A centre with this code already exists.');
      }
      throw e;
    }
  }
  async updateCentre(id: string, data: any) {
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.contactNo !== undefined) updateData.contactNo = data.contactNo;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.status !== undefined) updateData.status = data.status;
    return this.prisma.centre.update({ where: { id }, data: updateData });
  }
  async deleteCentre(id: string) {
    const centre = await this.prisma.centre.findUnique({
      where: { id },
      include: {
        _count: {
          select: { userCentres: true, batches: true, liveClasses: true, exams: true, Transaction: true }
        }
      }
    });

    if (!centre) throw new NotFoundException('Centre not found');

    const { userCentres, batches, liveClasses, exams, Transaction } = centre._count;
    if (userCentres > 0 || batches > 0 || liveClasses > 0 || exams > 0 || Transaction > 0) {
      throw new ConflictException(`Cannot delete: Found ${batches} batches, ${liveClasses} live classes, ${exams} exams, ${Transaction} transactions, and ${userCentres} users attached to this centre.`);
    }

    return this.prisma.centre.delete({ where: { id } });
  }

  // Academic Years
  async getAcademicYears() {
    return this.prisma.academicYear.findMany({ orderBy: { startDate: 'desc' } });
  }
  async createAcademicYear(data: { name: string; startDate: Date; endDate: Date; isActive?: boolean }) {
    return this.prisma.academicYear.create({ data });
  }

  // Boards
  async getBoards() {
    return this.prisma.board.findMany();
  }
  async createBoard(data: { name: string }) {
    try {
      return await this.prisma.board.create({ 
        data: {
          name: data.name
        } 
      });
    } catch (e: any) {
      if (e.code === 'P2002') {
        throw new ConflictException('A board with this name already exists.');
      }
      throw e;
    }
  }

  // Standards (Classes)
  async getStandards(boardId?: string) {
    return this.prisma.standard.findMany({
      where: boardId
        ? {
            OR: [
              { boardId },
              { boards: { some: { boardId } } }
            ]
          }
        : undefined,
      include: {
        board: true,
        boards: {
          include: {
            board: true
          }
        }
      },
      orderBy: { level: 'asc' }
    });
  }

  async createStandard(data: { name: string; code?: string; level?: number; boardId?: string; boardIds?: string[] }) {
    const boardIds = Array.isArray(data.boardIds) && data.boardIds.length > 0 
      ? data.boardIds 
      : (data.boardId ? [data.boardId] : []);
    const primaryBoardId = boardIds[0] || data.boardId || null;

    return this.prisma.standard.create({
      data: {
        name: data.name,
        level: data.level || 1,
        boardId: primaryBoardId,
        ...(boardIds.length > 0 ? {
          boards: {
            create: boardIds.map(bId => ({ boardId: bId }))
          }
        } : {})
      },
      include: {
        board: true,
        boards: {
          include: {
            board: true
          }
        }
      }
    });
  }

  // Batches
  async getBatches(boardId?: string, standardId?: string, user?: any, centreId?: string) {
    let effectiveCentres: string[] | null = null;
    if (user && !isSuperAdmin(user)) {
      const authorizedCentres = getAuthorizedCentreIds(user);
      if (centreId) {
        assertCentreAccess(user, centreId);
        effectiveCentres = [centreId];
      } else {
        effectiveCentres = authorizedCentres;
      }
    } else if (centreId) {
      effectiveCentres = [centreId];
    }

    return this.prisma.batch.findMany({
      where: {
        ...(boardId && { boardId }),
        ...(standardId && { standardId }),
        ...(effectiveCentres ? { centreId: { in: effectiveCentres } } : {}),
      },
      include: {
        board: true,
        standard: true,
        centre: true,
        track: true
      }
    });
  }

  async createBatch(data: { name: string; academicYearId: string; boardId: string; standardId: string; centreId: string; trackId?: string }, user?: any) {
    if (user && !isSuperAdmin(user)) {
      assertCentreAccess(user, data.centreId);
    }
    return this.prisma.batch.create({ data });
  }

  async deleteBatch(id: string, user?: any) {
    const batch = await this.prisma.batch.findUnique({ where: { id }, include: { _count: { select: { enrollments: true, assignments: true, exams: true } } } });
    if (!batch) return;

    if (user && !isSuperAdmin(user)) {
      if (!batch.centreId) {
        throw new ForbiddenException('Cannot delete batch: effective centre cannot be established.');
      }
      assertCentreAccess(user, batch.centreId);
    }
    
    const { enrollments, assignments, exams } = batch._count;
    if (enrollments > 0 || assignments > 0 || exams > 0) {
      throw new ConflictException(`Cannot delete: Found ${enrollments} enrollments, ${assignments} assignments, and ${exams} exams attached to this batch.`);
    }

    return this.prisma.batch.delete({ where: { id } });
  }


  // Target Tracks
  async getTracks() {
    return this.prisma.targetTrack.findMany({ orderBy: { name: 'asc' } });
  }

  async createTrack(data: { name: string }) {
    return this.prisma.targetTrack.create({ data });
  }

  async deleteTrack(id: string) {
    const track = await this.prisma.targetTrack.findUnique({ where: { id }, include: { _count: { select: { batches: true, enrollments: true, exams: true } } } });
    if (!track) return;

    const { batches, enrollments, exams } = track._count;
    if (batches > 0 || enrollments > 0 || exams > 0) {
      throw new ConflictException(`Cannot delete: Track is in use by ${batches} batches, ${enrollments} enrollments, and ${exams} exams.`);
    }
    
    return this.prisma.targetTrack.delete({ where: { id } });
  }

  // Subjects
  async getSubjects() {
    return this.prisma.subject.findMany();
  }
  
  async createSubject(data: { name: string; boardId?: string; standardId?: string }) {
    // Upsert the subject globally
    const subject = await this.prisma.subject.upsert({
      where: { name: data.name },
      update: {},
      create: { name: data.name },
    });
    
    // If board and standard provided, map it via Syllabus immediately
    if (data.boardId && data.standardId) {
      await this.prisma.syllabus.upsert({
        where: {
          boardId_standardId_subjectId: {
            boardId: data.boardId,
            standardId: data.standardId,
            subjectId: subject.id,
          },
        },
        update: {},
        create: {
          boardId: data.boardId,
          standardId: data.standardId,
          subjectId: subject.id,
        },
      });
    }
    
    return subject;
  }

  // Syllabi
  async getSyllabi(boardId?: string, standardId?: string) {
    return this.prisma.syllabus.findMany({
      where: {
        ...(boardId ? { boardId } : {}),
        ...(standardId ? { standardId } : {}),
      },
      include: { subject: true, standard: true, board: true }
    });
  }
  async createSyllabus(data: { boardId: string; standardId: string; subjectId: string }) {
    return this.prisma.syllabus.create({ data });
  }

  // Chapters
  async getChapters(syllabusId?: string) {
    if (syllabusId) {
      return this.prisma.chapter.findMany({ 
        where: { syllabusId },
        include: { topics: { include: { subtopics: true } } }
      });
    }
    return this.prisma.chapter.findMany({ 
      include: { 
        syllabus: { include: { subject: true } },
        topics: { include: { subtopics: true } }
      } 
    });
  }
  async createChapter(data: { name: string; syllabusId: string }) {
    return this.prisma.chapter.create({ data });
  }

  // Topics
  async getTopics(chapterId?: string) {
    if (chapterId) {
      return this.prisma.topic.findMany({ where: { chapterId }, include: { subtopics: true } });
    }
    return this.prisma.topic.findMany({ include: { chapter: true, subtopics: true } });
  }
  async createTopic(data: { name: string; chapterId: string }) {
    return this.prisma.topic.create({ data });
  }

  // Subtopics
  async getSubtopics(topicId?: string) {
    if (topicId) {
      return this.prisma.subtopic.findMany({ where: { topicId } });
    }
    return this.prisma.subtopic.findMany({ include: { topic: true } });
  }
  async createSubtopic(data: { name: string; topicId: string }) {
    return this.prisma.subtopic.create({ data });
  }

  // Deletions
  async deleteBoard(id: string) {
    const board = await this.prisma.board.findUnique({
      where: { id },
      include: {
        _count: { select: { batches: true, syllabi: true, liveClasses: true, exams: true, standards: true } }
      }
    });
    if (!board) throw new NotFoundException('Board not found');
    
    const { batches, syllabi, liveClasses, exams, standards } = board._count;
    if (batches > 0 || syllabi > 0 || liveClasses > 0 || exams > 0 || standards > 0) {
      throw new ConflictException(`Cannot delete: Found ${standards} classes, ${batches} batches, ${syllabi} syllabi, ${liveClasses} live classes, and ${exams} exams attached to this board.`);
    }
    return this.prisma.board.delete({ where: { id } });
  }

  async deleteStandard(id: string) {
    const standard = await this.prisma.standard.findUnique({
      where: { id },
      include: {
        _count: { select: { batches: true, syllabi: true, liveClasses: true, exams: true } }
      }
    });
    if (!standard) throw new NotFoundException('Class not found');

    const { batches, syllabi, liveClasses, exams } = standard._count;
    if (batches > 0 || syllabi > 0 || liveClasses > 0 || exams > 0) {
      throw new ConflictException(`Cannot delete: Found ${batches} batches, ${syllabi} syllabi, ${liveClasses} live classes, and ${exams} exams attached to this class. Please remove them first.`);
    }
    return this.prisma.standard.delete({ where: { id } });
  }

  async deleteSubject(id: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: {
        _count: { select: { syllabi: true, teacherAssignments: true, studentAssignments: true, exams: true } }
      }
    });
    if (!subject) throw new NotFoundException('Subject not found');

    const { syllabi, teacherAssignments, studentAssignments, exams } = subject._count;
    if (syllabi > 0 || teacherAssignments > 0 || studentAssignments > 0 || exams > 0) {
      throw new ConflictException(`Cannot delete: Found ${syllabi} syllabi, ${teacherAssignments} teacher assignments, ${studentAssignments} student assignments, and ${exams} exams attached to this subject.`);
    }
    return this.prisma.subject.delete({ where: { id } });
  }

  async deleteSyllabus(id: string) {
    const syllabus = await this.prisma.syllabus.findUnique({
      where: { id },
      include: { _count: { select: { chapters: true, materials: true } } }
    });
    if (!syllabus) throw new NotFoundException('Syllabus not found');

    if (syllabus._count.chapters > 0 || syllabus._count.materials > 0) {
      throw new ConflictException(`Cannot delete: Found ${syllabus._count.chapters} chapters and ${syllabus._count.materials} study materials attached to this syllabus.`);
    }
    return this.prisma.syllabus.delete({ where: { id } });
  }

  async deleteChapter(id: string) {
    const chapter = await this.prisma.chapter.findUnique({
      where: { id },
      include: { _count: { select: { topics: true, exams: true, materials: true, assignments: true } } }
    });
    if (!chapter) throw new NotFoundException('Chapter not found');

    const { topics, exams, materials, assignments } = chapter._count;
    if (topics > 0 || exams > 0 || materials > 0 || assignments > 0) {
      throw new ConflictException(`Cannot delete: Found ${topics} topics, ${materials} study materials, ${assignments} assignments, and ${exams} exams attached to this chapter.`);
    }
    return this.prisma.chapter.delete({ where: { id } });
  }

  async deleteTopic(id: string) {
    const topic = await this.prisma.topic.findUnique({
      where: { id },
      include: { _count: { select: { subtopics: true, exams: true, materials: true, assignments: true } } }
    });
    if (!topic) throw new NotFoundException('Topic not found');

    const { subtopics, exams, materials, assignments } = topic._count;
    if (subtopics > 0 || exams > 0 || materials > 0 || assignments > 0) {
      throw new ConflictException(`Cannot delete: Found ${subtopics} subtopics, ${materials} study materials, ${assignments} assignments, and ${exams} exams attached to this topic.`);
    }
    return this.prisma.topic.delete({ where: { id } });
  }

  async deleteSubtopic(id: string) {
    return this.prisma.subtopic.delete({ where: { id } });
  }
  async getSettings() {
    const centre = await this.prisma.centre.findFirst({
      orderBy: { createdAt: 'asc' }
    });
    const activeYear = await this.prisma.academicYear.findFirst({
      where: { isActive: true }
    });
    return {
      centreName: centre?.name || '',
      contactEmail: centre?.email || '',
      contactPhone: centre?.contactNo || '',
      currentYear: activeYear?.name || ''
    };
  }

  async updateSettings(data: any) {
    return this.prisma.$transaction(async (tx) => {
      let centre = await tx.centre.findFirst({ orderBy: { createdAt: 'asc' } });
      if (centre) {
        await tx.centre.update({
          where: { id: centre.id },
          data: {
            name: data.centreName || centre.name,
            email: data.contactEmail || centre.email,
            contactNo: data.contactPhone || centre.contactNo,
          }
        });
      } else {
        await tx.centre.create({
          data: {
            name: data.centreName || 'Educare',
            code: 'EDC1',
            email: data.contactEmail || '',
            contactNo: data.contactPhone || '',
          }
        });
      }

      if (data.currentYear) {
        let year = await tx.academicYear.findUnique({ where: { name: data.currentYear } });
        if (!year) {
          year = await tx.academicYear.create({
            data: { name: data.currentYear, isActive: true }
          });
        }
        
        // Deactivate others
        await tx.academicYear.updateMany({
          where: { id: { not: year.id } },
          data: { isActive: false }
        });
        
        // Activate current
        await tx.academicYear.update({
          where: { id: year.id },
          data: { isActive: true }
        });
      }
      
      return { success: true };
    });
  }

  // Star Achievers & Posters
  async getAchievers() {
    const list = await this.prisma.notice.findMany({
      where: { type: 'STAR_ACHIEVER' },
      orderBy: { createdAt: 'desc' },
    });
    const mapped = list.map(item => {
      let meta: any = {};
      try { meta = JSON.parse(item.content); } catch { meta = { rankOrScore: item.content, examOrCourse: '', order: 999 }; }
      return {
        id: item.id,
        name: item.title,
        title: item.title,
        rankOrScore: meta.rankOrScore || '',
        examOrCourse: meta.examOrCourse || '',
        imageUrl: item.imageUrl || undefined,
        badgeColor: meta.badgeColor || '#0162b1',
        order: typeof meta.order === 'number' ? meta.order : 999,
        isActive: item.isActive,
        createdAt: item.createdAt,
      };
    });
    mapped.sort((a, b) => a.order - b.order);
    return mapped;
  }

  async getPublicAchievers() {
    const list = await this.prisma.notice.findMany({
      where: { type: 'STAR_ACHIEVER', isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    const mapped = list.map(item => {
      let meta: any = {};
      try { meta = JSON.parse(item.content); } catch { meta = { rankOrScore: item.content, examOrCourse: '', order: 999 }; }
      return {
        id: item.id,
        name: item.title,
        title: item.title,
        rankOrScore: meta.rankOrScore || '',
        examOrCourse: meta.examOrCourse || '',
        imageUrl: item.imageUrl || undefined,
        badgeColor: meta.badgeColor || '#0162b1',
        order: typeof meta.order === 'number' ? meta.order : 999,
      };
    });
    mapped.sort((a, b) => a.order - b.order);
    return mapped;
  }

  async createAchiever(data: { name: string; rankOrScore?: string; examOrCourse?: string; imageUrl?: string; badgeColor?: string; order?: number }) {
    if (!data.name || !data.name.trim()) throw new BadRequestException('Title or student name is required');
    
    // Auto-compute order if not passed
    let order = Number(data.order);
    if (!order || isNaN(order)) {
      const existing = await this.prisma.notice.count({ where: { type: 'STAR_ACHIEVER' } });
      order = existing + 1;
    }

    const content = JSON.stringify({
      rankOrScore: data.rankOrScore?.trim() || '',
      examOrCourse: data.examOrCourse?.trim() || '',
      badgeColor: data.badgeColor || '#0162b1',
      order,
    });

    const created = await this.prisma.notice.create({
      data: {
        title: data.name.trim(),
        content,
        imageUrl: data.imageUrl ? data.imageUrl.trim() : null,
        type: 'STAR_ACHIEVER',
        isActive: true,
      },
    });

    return {
      id: created.id,
      name: created.title,
      title: created.title,
      rankOrScore: data.rankOrScore || '',
      examOrCourse: data.examOrCourse || '',
      imageUrl: created.imageUrl || undefined,
      badgeColor: data.badgeColor || '#0162b1',
      order,
      isActive: created.isActive,
    };
  }

  async reorderAchievers(orderedIds: string[]) {
    if (!Array.isArray(orderedIds)) throw new BadRequestException('orderedIds must be an array');
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      const item = await this.prisma.notice.findUnique({ where: { id } });
      if (item) {
        let meta: any = {};
        try { meta = JSON.parse(item.content); } catch {}
        meta.order = i + 1;
        await this.prisma.notice.update({
          where: { id },
          data: { content: JSON.stringify(meta) },
        });
      }
    }
    return { success: true };
  }

  async toggleAchieverActive(id: string) {
    const item = await this.prisma.notice.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Achiever poster not found');
    return this.prisma.notice.update({
      where: { id },
      data: { isActive: !item.isActive },
    });
  }

  async deleteAchiever(id: string) {
    const item = await this.prisma.notice.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Achiever poster not found');

    // Synchronized deletion: delete the image file from Cloudflare R2 bucket
    if (item.imageUrl && this.storageService) {
      try {
        await this.storageService.deleteFile(item.imageUrl, true);
      } catch (err) {
        console.warn(`[SetupService] Could not delete image from R2 (${item.imageUrl}):`, err);
      }
    }

    return this.prisma.notice.delete({ where: { id } });
  }

  // ---------------------------------------------------------------------------
  // Admission Rules & Regulations & Digital Undertaking Policy
  // ---------------------------------------------------------------------------

  async getAdmissionRules() {
    const list = await this.prisma.notice.findMany({
      where: { type: 'ADMISSION_RULE' },
      orderBy: { createdAt: 'asc' },
    });

    if (list.length === 0) {
      return DEFAULT_ADMISSION_RULES.map((rule, idx) => ({
        id: `default-${idx + 1}`,
        title: rule.title,
        content: rule.content,
        category: rule.category,
        order: rule.order,
        isRequiredAck: rule.isRequiredAck,
        isActive: true,
        isDefault: true,
        subsections: (rule as any).subsections || [],
      }));
    }

    const mapped = list.map(item => {
      let meta: any = {};
      try { meta = JSON.parse(item.content); } catch { meta = { description: item.content, category: 'General', order: 999 }; }
      return {
        id: item.id,
        title: item.title,
        content: meta.description || meta.content || '',
        category: meta.category || 'General',
        order: typeof meta.order === 'number' ? meta.order : 999,
        isRequiredAck: meta.isRequiredAck !== false,
        isActive: item.isActive,
        isDefault: false,
        subsections: Array.isArray(meta.subsections) ? meta.subsections : [],
        createdAt: item.createdAt,
      };
    });
    mapped.sort((a, b) => a.order - b.order);
    return mapped;
  }

  async getAdmissionPolicy() {
    const policyNotice = await this.prisma.notice.findFirst({
      where: { type: 'ADMISSION_POLICY' },
    });

    if (!policyNotice) {
      return DEFAULT_ADMISSION_POLICY;
    }

    try {
      const parsed = JSON.parse(policyNotice.content);
      const declarationBulletins =
        Array.isArray(parsed.declarationBulletins) && parsed.declarationBulletins.length > 0
          ? parsed.declarationBulletins.filter((b: any) => typeof b === 'string' && b.trim().length > 0)
          : (typeof parsed.declarationText === 'string' && parsed.declarationText.includes('\n')
              ? parsed.declarationText.split(/\n+/).map((line: string) => line.replace(/^[-*•\d.]+\s*/, '').trim()).filter(Boolean)
              : DEFAULT_ADMISSION_POLICY.declarationBulletins);

      return {
        title: policyNotice.title || DEFAULT_ADMISSION_POLICY.title,
        subtitle: parsed.subtitle || DEFAULT_ADMISSION_POLICY.subtitle,
        description: parsed.description || DEFAULT_ADMISSION_POLICY.description,
        declarationText: parsed.declarationText || DEFAULT_ADMISSION_POLICY.declarationText,
        declarationBulletins,
        requireSignature: parsed.requireSignature !== false,
        allowUploadSignature: parsed.allowUploadSignature !== false,
        requireParentSignature: parsed.requireParentSignature !== false,
      };
    } catch {
      return DEFAULT_ADMISSION_POLICY;
    }
  }

  async updateAdmissionPolicy(data: {
    title?: string;
    subtitle?: string;
    description?: string;
    declarationText?: string;
    declarationBulletins?: string[];
    requireSignature?: boolean;
    allowUploadSignature?: boolean;
    requireParentSignature?: boolean;
  }) {
    const existing = await this.prisma.notice.findFirst({
      where: { type: 'ADMISSION_POLICY' },
    });

    const sanitizedBulletins = Array.isArray(data.declarationBulletins)
      ? data.declarationBulletins
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .slice(0, 20)
          .map((item) => item.replace(/<[^>]*>?/gm, '').trim().slice(0, 500))
      : undefined;

    const content = JSON.stringify({
      subtitle: data.subtitle?.trim() || DEFAULT_ADMISSION_POLICY.subtitle,
      description: data.description?.trim() || DEFAULT_ADMISSION_POLICY.description,
      declarationText: data.declarationText?.trim() || DEFAULT_ADMISSION_POLICY.declarationText,
      declarationBulletins: sanitizedBulletins || DEFAULT_ADMISSION_POLICY.declarationBulletins,
      requireSignature: data.requireSignature !== undefined ? Boolean(data.requireSignature) : true,
      allowUploadSignature: data.allowUploadSignature !== undefined ? Boolean(data.allowUploadSignature) : true,
      requireParentSignature: data.requireParentSignature !== undefined ? Boolean(data.requireParentSignature) : true,
    });

    const title = data.title?.trim() || DEFAULT_ADMISSION_POLICY.title;

    if (existing) {
      await this.prisma.notice.update({
        where: { id: existing.id },
        data: { title, content },
      });
    } else {
      await this.prisma.notice.create({
        data: {
          title,
          content,
          type: 'ADMISSION_POLICY',
          isActive: true,
        },
      });
    }

    return this.getAdmissionPolicy();
  }

  async createAdmissionRule(data: {
    title: string;
    content: string;
    category?: string;
    order?: number;
    isRequiredAck?: boolean;
    subsections?: Array<{ id?: string; title: string; content?: string }>;
  }) {
    if (!data.title || !data.title.trim()) throw new BadRequestException('Rule title is required');
    if (!data.content || !data.content.trim()) throw new BadRequestException('Rule clause/content is required');

    let order = Number(data.order);
    if (!order || isNaN(order)) {
      const existing = await this.prisma.notice.count({ where: { type: 'ADMISSION_RULE' } });
      order = existing + 1;
    }

    const sanitizedSubsections = Array.isArray(data.subsections)
      ? data.subsections.slice(0, 20).map((sub, idx) => ({
          id: String(sub.id || `sub-${idx + 1}`),
          title: String(sub.title || '').trim().slice(0, 200),
          content: String(sub.content || '').trim().slice(0, 1000),
        })).filter(s => s.title.length > 0)
      : [];

    const payload = JSON.stringify({
      description: data.content.trim().slice(0, 5000),
      category: data.category?.trim().slice(0, 100) || 'General',
      order,
      isRequiredAck: data.isRequiredAck !== false,
      subsections: sanitizedSubsections,
    });

    const created = await this.prisma.notice.create({
      data: {
        title: data.title.trim().slice(0, 200),
        content: payload,
        type: 'ADMISSION_RULE',
        isActive: true,
      },
    });

    return {
      id: created.id,
      title: created.title,
      content: data.content.trim(),
      category: data.category?.trim() || 'General',
      order,
      isRequiredAck: data.isRequiredAck !== false,
      isActive: created.isActive,
      isDefault: false,
      subsections: sanitizedSubsections,
    };
  }

  async updateAdmissionRule(id: string, data: {
    title?: string;
    content?: string;
    category?: string;
    order?: number;
    isRequiredAck?: boolean;
    isActive?: boolean;
    subsections?: Array<{ id?: string; title: string; content?: string }>;
  }) {
    // If updating a default rule that hasn't been saved to DB yet, convert to a real record
    if (id.startsWith('default-')) {
      const defaultIdx = parseInt(id.replace('default-', ''), 10) - 1;
      const def = DEFAULT_ADMISSION_RULES[defaultIdx] || DEFAULT_ADMISSION_RULES[0];
      return this.createAdmissionRule({
        title: data.title !== undefined ? data.title : def.title,
        content: data.content !== undefined ? data.content : def.content,
        category: data.category !== undefined ? data.category : def.category,
        order: data.order !== undefined ? data.order : def.order,
        isRequiredAck: data.isRequiredAck !== undefined ? data.isRequiredAck : def.isRequiredAck,
        subsections: data.subsections !== undefined ? data.subsections : (def as any).subsections,
      });
    }

    const item = await this.prisma.notice.findUnique({ where: { id } });
    if (!item || item.type !== 'ADMISSION_RULE') {
      throw new NotFoundException('Admission rule not found');
    }

    let meta: any = {};
    try { meta = JSON.parse(item.content); } catch {}

    const title = data.title !== undefined ? data.title.trim().slice(0, 200) : item.title;
    const content = data.content !== undefined ? data.content.trim().slice(0, 5000) : (meta.description || meta.content || '');
    const category = data.category !== undefined ? data.category.trim().slice(0, 100) : (meta.category || 'General');
    const order = typeof data.order === 'number' ? data.order : (meta.order || 1);
    const isRequiredAck = data.isRequiredAck !== undefined ? Boolean(data.isRequiredAck) : (meta.isRequiredAck !== false);
    const isActive = data.isActive !== undefined ? Boolean(data.isActive) : item.isActive;
    const subsections = data.subsections !== undefined
      ? (Array.isArray(data.subsections)
          ? data.subsections.slice(0, 20).map((sub, idx) => ({
              id: String(sub.id || `sub-${idx + 1}`),
              title: String(sub.title || '').trim().slice(0, 200),
              content: String(sub.content || '').trim().slice(0, 1000),
            })).filter(s => s.title.length > 0)
          : [])
      : (Array.isArray(meta.subsections) ? meta.subsections : []);

    const updated = await this.prisma.notice.update({
      where: { id },
      data: {
        title,
        content: JSON.stringify({ description: content, category, order, isRequiredAck, subsections }),
        isActive,
      },
    });

    return {
      id: updated.id,
      title: updated.title,
      content,
      category,
      order,
      isRequiredAck,
      isActive: updated.isActive,
      isDefault: false,
      subsections,
    };
  }

  async deleteAdmissionRule(id: string) {
    if (id.startsWith('default-')) {
      return { success: true, message: 'Default template ignored' };
    }
    const item = await this.prisma.notice.findUnique({ where: { id } });
    if (!item || item.type !== 'ADMISSION_RULE') {
      throw new NotFoundException('Admission rule not found');
    }
    await this.prisma.notice.delete({ where: { id } });
    return { success: true };
  }

  async toggleAdmissionRuleActive(id: string) {
    if (id.startsWith('default-')) {
      const defaultIdx = parseInt(id.replace('default-', ''), 10) - 1;
      const def = DEFAULT_ADMISSION_RULES[defaultIdx] || DEFAULT_ADMISSION_RULES[0];
      const created = await this.createAdmissionRule({
        title: def.title,
        content: def.content,
        category: def.category,
        order: def.order,
        isRequiredAck: def.isRequiredAck,
        subsections: (def as any).subsections,
      });
      return this.prisma.notice.update({
        where: { id: created.id },
        data: { isActive: false },
      });
    }

    const item = await this.prisma.notice.findUnique({ where: { id } });
    if (!item || item.type !== 'ADMISSION_RULE') {
      throw new NotFoundException('Admission rule not found');
    }
    return this.prisma.notice.update({
      where: { id },
      data: { isActive: !item.isActive },
    });
  }

  async reorderAdmissionRules(orderedIds: string[]) {
    if (!Array.isArray(orderedIds)) throw new BadRequestException('orderedIds must be an array');
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (id.startsWith('default-')) continue;
      const item = await this.prisma.notice.findUnique({ where: { id } });
      if (item && item.type === 'ADMISSION_RULE') {
        let meta: any = {};
        try { meta = JSON.parse(item.content); } catch {}
        meta.order = i + 1;
        await this.prisma.notice.update({
          where: { id },
          data: { content: JSON.stringify(meta) },
        });
      }
    }
    return { success: true };
  }

  async getPublicAdmissionRules() {
    const [policy, rules] = await Promise.all([
      this.getAdmissionPolicy(),
      this.getAdmissionRules(),
    ]);

    const activeRules = rules.filter(r => r.isActive);
    return {
      policy,
      rules: activeRules,
    };
  }

  async getPublicAdmissionOptions(): Promise<any> {
    const [boards, standards, courses, tracks, centres] = await Promise.all([
      this.prisma.board.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.standard.findMany({
        select: {
          id: true,
          name: true,
          level: true,
          boardId: true,
          boards: {
            select: { boardId: true },
          },
        },
        orderBy: { level: 'asc' },
      }),
      this.prisma.course.findMany({
        where: { isPublished: true },
        select: {
          id: true,
          title: true,
          slug: true,
          level: true,
          price: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.targetTrack.findMany({
        select: {
          id: true,
          name: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.centre.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          code: true,
          address: true,
          contactNo: true,
          email: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const isTurnstileDisabled = process.env.DISABLE_TURNSTILE === 'true';
    const turnstileSiteKey = process.env.TURNSTILE_SITE_KEY || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;

    return {
      boards,
      standards,
      courses,
      tracks,
      centres,
      turnstileSiteKey,
      turnstileRequired: !isTurnstileDisabled && Boolean(process.env.TURNSTILE_SECRET_KEY),
    };
  }
}

export const DEFAULT_ADMISSION_POLICY = {
  title: "Educare Academy Student Code & Admission Undertaking",
  subtitle: "Institutional Guidelines, Academic Code of Conduct & Guardian Declaration",
  description: "All students admitted to Educare Institute of Learning are expected to observe high standards of academic diligence, discipline, and mutual respect. Please read the terms below carefully before signing.",
  declarationText: "I hereby confirm that all information provided in this admission application is true, accurate, and complete. I have read, understood, and solemnly undertake to abide by the rules, code of conduct, attendance norms, and disciplinary regulations of Educare Institute.",
  declarationBulletins: [
    "I confirm that all details, contact information, and academic background submitted in this admission form are true, accurate, and authentic.",
    "I have carefully reviewed the Institutional Rules & Guidelines and solemnly undertake to abide by the academic code of conduct and disciplinary regulations.",
    "I understand that tuition and course fees must be remitted as per the agreed schedule and that registration charges are non-refundable once classes commence.",
    "I agree to maintain the required minimum 85% attendance, punctuality, and complete all scheduled evaluations and assignments.",
    "I understand that any willful breach of discipline, damage to property, or submission of fraudulent records may lead to disciplinary action or termination of enrollment.",
  ],
  requireSignature: true,
  allowUploadSignature: true,
  requireParentSignature: true,
};

export const DEFAULT_ADMISSION_RULES = [
  {
    title: "Attendance & Punctuality Norms",
    category: "Attendance",
    content: "Students must maintain a minimum of 85% attendance across all scheduled theory, discussion, and practical laboratory sessions. In case of illness or emergency, a written leave letter signed by the parent/guardian must be submitted to the academic office within 48 hours.",
    order: 1,
    isRequiredAck: true,
    subsections: [
      {
        id: "sub-1-1",
        title: "85% Minimum Lecture & Lab Quota",
        content: "Attendance is calculated monthly. Falling below 85% triggers automated SMS alerts to parents and loss of test-series sitting clearance.",
      },
      {
        id: "sub-1-2",
        title: "Medical Emergency & Leave Letters",
        content: "Absences due to medical reasons must be certified by a registered physician and countersigned by the student's legal guardian.",
      },
      {
        id: "sub-1-3",
        title: "Late Arrival & Gate Pass Protocol",
        content: "Entering 10 minutes past class commencement requires special entry approval from the Academic Dean.",
      },
    ],
  },
  {
    title: "Academic Integrity & Assessment Discipline",
    category: "Academics",
    content: "Academic dishonesty, including copying in examinations, unauthorized collaboration during test series, or plagiarism in assignments, is strictly prohibited. Violations will result in cancellation of test results and immediate parent-teacher consultation.",
    order: 2,
    isRequiredAck: true,
    subsections: [
      {
        id: "sub-2-1",
        title: "Proctored Examination Discipline",
        content: "Possession of unauthorized formula sheets, written chits, or smart devices in the exam hall leads to automatic paper cancellation.",
      },
      {
        id: "sub-2-2",
        title: "Mandatory Sunday Mock Series",
        content: "Regular test attendance is compulsory. Unexcused absence from three consecutive mock exams invites review of student enrollment.",
      },
      {
        id: "sub-2-3",
        title: "Remedial & Mentor Sessions",
        content: "Students scoring below performance thresholds must attend dedicated weekly mentor-led concept reinforcement sessions.",
      },
    ],
  },
  {
    title: "Campus Decorum, Dress Code & Mutual Respect",
    category: "Conduct",
    content: "Students must dress in modest, neat, and respectable attire appropriate for an academic environment. Respectful behavior towards teachers, peer students, and support staff is non-negotiable. Ragging, bullying, or disrespectful language will lead to immediate expulsion.",
    order: 3,
    isRequiredAck: true,
    subsections: [
      {
        id: "sub-3-1",
        title: "Institutional ID Card Display",
        content: "Students must wear the official Educare lanyard and smart ID badge while on campus premises for security verification.",
      },
      {
        id: "sub-3-2",
        title: "Zero-Tolerance Anti-Bullying Mandate",
        content: "Educare enforces zero tolerance against intimidation, ragging, or discriminatory remarks online or offline.",
      },
      {
        id: "sub-3-3",
        title: "Care of Institutional Infrastructure",
        content: "Defacing desks, damaging audio-visual equipment, or misusing laboratory chemicals incurs restitution charges.",
      },
    ],
  },
  {
    title: "Digital Device & Mobile Phone Policy",
    category: "Discipline",
    content: "Personal smartphones and electronic gadgets must be switched off or placed in silent mode during active lecture hours unless explicitly permitted by the instructor for interactive learning exercises.",
    order: 4,
    isRequiredAck: false,
    subsections: [
      {
        id: "sub-4-1",
        title: "Classroom Silent Storage",
        content: "Mobile phones must be deposited in assigned pocket bays or kept silent in bags during all teaching hours.",
      },
      {
        id: "sub-4-2",
        title: "Authorized Interactive Quizzing",
        content: "Devices may be used only when faculty members explicitly initiate in-class LMS poll or quiz activities.",
      },
      {
        id: "sub-4-3",
        title: "Lecture Recording Prohibition",
        content: "Unauthorized audio or video recording of classroom lectures or distribution of faculty materials is strictly prohibited.",
      },
    ],
  },
  {
    title: "Fee Schedule, Batch Continuity & Refund Undertaking",
    category: "Finance",
    content: "Tuition and course fees must be remitted as per the agreed schedule. Admission and registration charges are non-refundable once classes commence. Batch or center change requests are subject to seat availability and administrative approval.",
    order: 5,
    isRequiredAck: true,
    subsections: [
      {
        id: "sub-5-1",
        title: "Instalment Timelines & Grace Windows",
        content: "Fee instalments are due on or before the 10th of the designated term month. A 5-day grace window applies before portal access is paused.",
      },
      {
        id: "sub-5-2",
        title: "Non-Refundable Registration Fee",
        content: "Registration, course pack materials, and LMS setup charges are non-refundable after student orientation.",
      },
      {
        id: "sub-5-3",
        title: "Inter-Campus Transfer Protocol",
        content: "Transfers between institutional campuses are accommodated subject to batch quota vacancy.",
      },
    ],
  },
];
