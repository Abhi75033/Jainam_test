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
} from './organizations.dto';
import { makeOrganizationController, bhojanalayDirectory } from './organizations.controller';

export const templeRoutes = Router();
const ctrl = makeOrganizationController('TEMPLE');

// Only Super Admin creates Temples (§5.5)
templeRoutes.post('/', requireAuth, requireRole('SUPER_ADMIN'), validate(createOrganizationSchema), ctrl.create);
templeRoutes.get('/bhojanalay-directory', requireAuth, bhojanalayDirectory);
templeRoutes.get('/', requireAuth, ctrl.list);
templeRoutes.get('/:organizationId', requireAuth, ctrl.get);
templeRoutes.patch('/:organizationId', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, validate(updateOrganizationSchema), ctrl.update);

templeRoutes.post('/:organizationId/gallery', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, validate(addGalleryImageSchema), ctrl.addGalleryImage);
templeRoutes.post('/:organizationId/trustees', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, validate(addTrusteeSchema), ctrl.addTrustee);
templeRoutes.post('/:organizationId/volunteers', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, validate(addVolunteerSchema), ctrl.addVolunteer);
templeRoutes.post('/:organizationId/contacts', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, validate(addContactSchema), ctrl.addContact);
templeRoutes.put('/:organizationId/dhaja/:year', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, validate(addDhajaRecordSchema), ctrl.upsertDhajaRecord);
templeRoutes.post('/:organizationId/reviews', requireAuth, validate(addReviewSchema), ctrl.addReview);
templeRoutes.patch('/reviews/:reviewId/reply', requireAuth, requirePermission('TEMPLES', 'EDIT'), validate(replyReviewSchema), ctrl.replyReview);
templeRoutes.delete('/reviews/:reviewId', requireAuth, requireRole('SUPER_ADMIN'), ctrl.hideReview);
templeRoutes.post('/:organizationId/notices', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, validate(addNoticeSchema), ctrl.addNotice);
templeRoutes.post('/:organizationId/follow', requireAuth, ctrl.follow);
templeRoutes.post('/:organizationId/unfollow', requireAuth, ctrl.unfollow);
templeRoutes.post('/:organizationId/report-incorrect-info', requireAuth, validate(reportIncorrectInfoSchema), ctrl.reportIncorrectInfo);
