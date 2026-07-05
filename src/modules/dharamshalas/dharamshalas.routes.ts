import { Router } from 'express';
import { requireAuth, requireRole, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  addTrusteeSchema,
  addContactSchema,
  addReviewSchema,
  replyReviewSchema,
  addNoticeSchema,
  addGalleryImageSchema,
  reportIncorrectInfoSchema,
} from '@/modules/temples/organizations.dto';
import { makeOrganizationController } from '@/modules/temples/organizations.controller';
import { createBuildingSchema, createWingSchema, createRoomSchema, updateRoomSchema } from './dharamshalas.dto';
import * as dharamshalaController from './dharamshalas.controller';

/**
 * Dharamshala (§5.6): same profile pattern as temples (shared org model) plus
 * the multi-building structure. Visible to ALL members regardless of community.
 */
export const dharamshalaRoutes = Router();
const ctrl = makeOrganizationController('DHARAMSHALA');

dharamshalaRoutes.post('/', requireAuth, requireRole('SUPER_ADMIN'), validate(createOrganizationSchema), ctrl.create);
dharamshalaRoutes.get('/', requireAuth, ctrl.list);
dharamshalaRoutes.get('/:organizationId', requireAuth, ctrl.get);
dharamshalaRoutes.patch('/:organizationId', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, validate(updateOrganizationSchema), ctrl.update);

dharamshalaRoutes.post('/:organizationId/gallery', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, validate(addGalleryImageSchema), ctrl.addGalleryImage);
dharamshalaRoutes.post('/:organizationId/trustees', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, validate(addTrusteeSchema), ctrl.addTrustee);
dharamshalaRoutes.post('/:organizationId/contacts', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, validate(addContactSchema), ctrl.addContact);
dharamshalaRoutes.post('/:organizationId/reviews', requireAuth, validate(addReviewSchema), ctrl.addReview);
dharamshalaRoutes.patch('/reviews/:reviewId/reply', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), validate(replyReviewSchema), ctrl.replyReview);
dharamshalaRoutes.delete('/reviews/:reviewId', requireAuth, requireRole('SUPER_ADMIN'), ctrl.hideReview);
dharamshalaRoutes.post('/:organizationId/notices', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, validate(addNoticeSchema), ctrl.addNotice);
dharamshalaRoutes.post('/:organizationId/follow', requireAuth, ctrl.follow);
dharamshalaRoutes.post('/:organizationId/unfollow', requireAuth, ctrl.unfollow);
dharamshalaRoutes.post('/:organizationId/report-incorrect-info', requireAuth, validate(reportIncorrectInfoSchema), ctrl.reportIncorrectInfo);

// Multi-building structure (§5.6)
dharamshalaRoutes.get('/:organizationId/structure', requireAuth, dharamshalaController.getStructure);
dharamshalaRoutes.post('/:organizationId/buildings', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), scopeToOrganization, validate(createBuildingSchema), dharamshalaController.createBuilding);
dharamshalaRoutes.post('/buildings/:buildingId/wings', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), validate(createWingSchema), dharamshalaController.createWing);
dharamshalaRoutes.post('/wings/:wingId/rooms', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), validate(createRoomSchema), dharamshalaController.createRoom);
dharamshalaRoutes.patch('/rooms/:roomId', requireAuth, requirePermission('DHARAMSHALAS', 'EDIT'), validate(updateRoomSchema), dharamshalaController.updateRoom);
