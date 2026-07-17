import { Router } from 'express';
import { requireAuth, requireRole, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import multer from 'multer';
import {
  createOrganizationSchema, updateOrganizationSchema, addTrusteeSchema,
  addContactSchema, addReviewSchema, replyReviewSchema, addNoticeSchema,
  addGalleryImageSchema, reportIncorrectInfoSchema, addDhajaRecordSchema,
} from '@/modules/temples/organizations.dto';
import { makeOrganizationController, orgExtras } from '@/modules/temples/organizations.controller';
import { createBuildingSchema, createWingSchema, createRoomSchema, updateRoomSchema } from './dharamshalas.dto';
import * as dharamshalaController from './dharamshalas.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const dharamshalaRoutes = Router();
const ctrl = makeOrganizationController('DHARAMSHALA');
const extra = orgExtras('DHARAMSHALA');

dharamshalaRoutes.post('/', requireAuth, requireRole('SUPER_ADMIN'), validate(createOrganizationSchema), ctrl.create);
dharamshalaRoutes.get('/', requireAuth, ctrl.list);
dharamshalaRoutes.get('/:organizationId', requireAuth, ctrl.get);
dharamshalaRoutes.patch('/:organizationId', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, validate(updateOrganizationSchema), ctrl.update);

// Logo upload
dharamshalaRoutes.post('/:organizationId/logo', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, upload.single('logo'), extra.uploadLogo);

// Gallery
dharamshalaRoutes.post('/:organizationId/gallery', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, validate(addGalleryImageSchema), ctrl.addGalleryImage);
dharamshalaRoutes.post('/:organizationId/gallery/bulk', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, upload.array('images', 20), extra.bulkUploadGallery);
dharamshalaRoutes.delete('/:organizationId/gallery/:imageId', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, extra.deleteGalleryImage);

// Trustees
dharamshalaRoutes.post('/:organizationId/trustees', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, validate(addTrusteeSchema), ctrl.addTrustee);
dharamshalaRoutes.delete('/:organizationId/trustees/:trusteeId', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, extra.deleteTrustee);

// Contacts
dharamshalaRoutes.post('/:organizationId/contacts', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, validate(addContactSchema), ctrl.addContact);
dharamshalaRoutes.delete('/:organizationId/contacts/:contactId', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, extra.deleteContact);

// Dhaja
dharamshalaRoutes.put('/:organizationId/dhaja/:year', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, validate(addDhajaRecordSchema), ctrl.upsertDhajaRecord);
dharamshalaRoutes.delete('/:organizationId/dhaja/:dhajaId', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, extra.deleteDhaja);

// Reviews
dharamshalaRoutes.post('/:organizationId/reviews', requireAuth, validate(addReviewSchema), ctrl.addReview);
dharamshalaRoutes.patch('/reviews/:reviewId/reply', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), validate(replyReviewSchema), ctrl.replyReview);
dharamshalaRoutes.delete('/reviews/:reviewId', requireAuth, requireRole('SUPER_ADMIN'), ctrl.hideReview);

// Notices
dharamshalaRoutes.post('/:organizationId/notices', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, validate(addNoticeSchema), ctrl.addNotice);
dharamshalaRoutes.delete('/:organizationId/notices/:noticeId', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, extra.deleteNotice);

// Follow / Unfollow
dharamshalaRoutes.post('/:organizationId/follow', requireAuth, ctrl.follow);
dharamshalaRoutes.post('/:organizationId/unfollow', requireAuth, ctrl.unfollow);
dharamshalaRoutes.post('/:organizationId/report-incorrect-info', requireAuth, validate(reportIncorrectInfoSchema), ctrl.reportIncorrectInfo);

// Multi-building structure (§5.6)
dharamshalaRoutes.get('/:organizationId/structure', requireAuth, dharamshalaController.getStructure);
dharamshalaRoutes.post('/:organizationId/buildings', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, validate(createBuildingSchema), dharamshalaController.createBuilding);
dharamshalaRoutes.post('/buildings/:buildingId/wings', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), validate(createWingSchema), dharamshalaController.createWing);
dharamshalaRoutes.post('/wings/:wingId/rooms', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), validate(createRoomSchema), dharamshalaController.createRoom);
dharamshalaRoutes.patch('/rooms/:roomId', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), validate(updateRoomSchema), dharamshalaController.updateRoom);

