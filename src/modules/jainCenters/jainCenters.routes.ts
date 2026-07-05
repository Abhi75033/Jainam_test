import { Router } from 'express';
import { requireAuth, requireRole, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  addTrusteeSchema,
  addVolunteerSchema,
  addContactSchema,
  addDhajaRecordSchema,
  addReviewSchema,
  replyReviewSchema,
  addNoticeSchema,
  addGalleryImageSchema,
  reportIncorrectInfoSchema,
} from '@/modules/temples/organizations.dto';
import { makeOrganizationController } from '@/modules/temples/organizations.controller';

/** Jain Centers share the Temple/Derasar form and model (§5.5 — "one shared form/model"). */
export const jainCenterRoutes = Router();
const ctrl = makeOrganizationController('JAIN_CENTER');

jainCenterRoutes.post('/', requireAuth, requireRole('SUPER_ADMIN'), validate(createOrganizationSchema), ctrl.create);
jainCenterRoutes.get('/', requireAuth, ctrl.list);
jainCenterRoutes.get('/:organizationId', requireAuth, ctrl.get);
jainCenterRoutes.patch('/:organizationId', requireAuth, requirePermission('JAIN_CENTERS', 'EDIT'), scopeToOrganization, validate(updateOrganizationSchema), ctrl.update);

jainCenterRoutes.post('/:organizationId/gallery', requireAuth, requirePermission('JAIN_CENTERS', 'EDIT'), scopeToOrganization, validate(addGalleryImageSchema), ctrl.addGalleryImage);
jainCenterRoutes.post('/:organizationId/trustees', requireAuth, requirePermission('JAIN_CENTERS', 'EDIT'), scopeToOrganization, validate(addTrusteeSchema), ctrl.addTrustee);
jainCenterRoutes.post('/:organizationId/volunteers', requireAuth, requirePermission('JAIN_CENTERS', 'EDIT'), scopeToOrganization, validate(addVolunteerSchema), ctrl.addVolunteer);
jainCenterRoutes.post('/:organizationId/contacts', requireAuth, requirePermission('JAIN_CENTERS', 'EDIT'), scopeToOrganization, validate(addContactSchema), ctrl.addContact);
jainCenterRoutes.put('/:organizationId/dhaja/:year', requireAuth, requirePermission('JAIN_CENTERS', 'EDIT'), scopeToOrganization, validate(addDhajaRecordSchema), ctrl.upsertDhajaRecord);
jainCenterRoutes.post('/:organizationId/reviews', requireAuth, validate(addReviewSchema), ctrl.addReview);
jainCenterRoutes.patch('/reviews/:reviewId/reply', requireAuth, requirePermission('JAIN_CENTERS', 'EDIT'), validate(replyReviewSchema), ctrl.replyReview);
jainCenterRoutes.delete('/reviews/:reviewId', requireAuth, requireRole('SUPER_ADMIN'), ctrl.hideReview);
jainCenterRoutes.post('/:organizationId/notices', requireAuth, requirePermission('JAIN_CENTERS', 'EDIT'), scopeToOrganization, validate(addNoticeSchema), ctrl.addNotice);
jainCenterRoutes.post('/:organizationId/follow', requireAuth, ctrl.follow);
jainCenterRoutes.post('/:organizationId/unfollow', requireAuth, ctrl.unfollow);
jainCenterRoutes.post('/:organizationId/report-incorrect-info', requireAuth, validate(reportIncorrectInfoSchema), ctrl.reportIncorrectInfo);
