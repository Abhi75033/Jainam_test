import { Router } from 'express';
import { requireAuth, requireRole, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import multer from 'multer';
import {
  createOrganizationSchema, updateOrganizationSchema, addTrusteeSchema,
  addVolunteerSchema, addContactSchema, addDhajaRecordSchema, addReviewSchema,
  replyReviewSchema, addNoticeSchema, addGalleryImageSchema, reportIncorrectInfoSchema,
} from './organizations.dto';
import { makeOrganizationController, bhojanalayDirectory, orgExtras } from './organizations.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const templeRoutes = Router();
const ctrl = makeOrganizationController('TEMPLE');
const extra = orgExtras('TEMPLE');

// Only Super Admin creates Temples (§5.5)
templeRoutes.post('/', requireAuth, requireRole('SUPER_ADMIN'), validate(createOrganizationSchema), ctrl.create);
templeRoutes.get('/bhojanalay-directory', requireAuth, bhojanalayDirectory);
templeRoutes.get('/', requireAuth, ctrl.list);
templeRoutes.get('/:organizationId', requireAuth, ctrl.get);
templeRoutes.patch('/:organizationId', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, validate(updateOrganizationSchema), ctrl.update);

// Logo upload
templeRoutes.post('/:organizationId/logo', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, upload.single('logo'), extra.uploadLogo);

// Gallery — add single, bulk upload, delete
templeRoutes.post('/:organizationId/gallery', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, validate(addGalleryImageSchema), ctrl.addGalleryImage);
templeRoutes.post('/:organizationId/gallery/bulk', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, upload.array('images', 20), extra.bulkUploadGallery);
templeRoutes.delete('/:organizationId/gallery/:imageId', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, extra.deleteGalleryImage);

// Trustees — add, delete
templeRoutes.post('/:organizationId/trustees', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, validate(addTrusteeSchema), ctrl.addTrustee);
templeRoutes.delete('/:organizationId/trustees/:trusteeId', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, extra.deleteTrustee);

// Contacts — add, delete
templeRoutes.post('/:organizationId/contacts', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, validate(addContactSchema), ctrl.addContact);
templeRoutes.delete('/:organizationId/contacts/:contactId', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, extra.deleteContact);

// Dhaja
templeRoutes.put('/:organizationId/dhaja/:year', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, validate(addDhajaRecordSchema), ctrl.upsertDhajaRecord);
templeRoutes.delete('/:organizationId/dhaja/:dhajaId', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, extra.deleteDhaja);

// Reviews — add, reply, delete
templeRoutes.post('/:organizationId/reviews', requireAuth, validate(addReviewSchema), ctrl.addReview);
templeRoutes.patch('/reviews/:reviewId/reply', requireAuth, requirePermission('TEMPLES', 'EDIT'), validate(replyReviewSchema), ctrl.replyReview);
templeRoutes.delete('/reviews/:reviewId', requireAuth, requireRole('SUPER_ADMIN'), ctrl.hideReview);

// Notices — add, delete
templeRoutes.post('/:organizationId/notices', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, validate(addNoticeSchema), ctrl.addNotice);
templeRoutes.delete('/:organizationId/notices/:noticeId', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, extra.deleteNotice);

// Volunteers
templeRoutes.post('/:organizationId/volunteers', requireAuth, requirePermission('TEMPLES', 'EDIT'), scopeToOrganization, validate(addVolunteerSchema), ctrl.addVolunteer);

// Follow / Unfollow
templeRoutes.post('/:organizationId/follow', requireAuth, ctrl.follow);
templeRoutes.post('/:organizationId/unfollow', requireAuth, ctrl.unfollow);
templeRoutes.post('/:organizationId/report-incorrect-info', requireAuth, validate(reportIncorrectInfoSchema), ctrl.reportIncorrectInfo);

