import { Router } from 'express';
import { requireAuth, requirePermission, scopeToOrganization } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import {
  createBookingItemSchema,
  updateBookingItemSchema,
  addBlackoutDateSchema,
  addInternalReservationSchema,
  availabilityQuerySchema,
  submitBookingSchema,
  bookingDecisionSchema,
  submitPaymentProofSchema,
  paymentVerificationSchema,
  myBookingsQuerySchema,
} from './bookings.dto';
import * as bookingsController from './bookings.controller';

export const bookingRoutes = Router();

// Booking item configuration (org admins)
bookingRoutes.post('/items', requireAuth, requirePermission('BOOKINGS', 'CREATE'), scopeToOrganization, validate(createBookingItemSchema), bookingsController.createBookingItem);
bookingRoutes.patch('/items/:itemId', requireAuth, requirePermission('BOOKINGS', 'EDIT'), validate(updateBookingItemSchema), bookingsController.updateBookingItem);
bookingRoutes.post('/items/:itemId/blackout-dates', requireAuth, requirePermission('BOOKINGS', 'EDIT'), validate(addBlackoutDateSchema), bookingsController.addBlackoutDate);
bookingRoutes.post('/items/:itemId/internal-reservations', requireAuth, requirePermission('BOOKINGS', 'CREATE'), validate(addInternalReservationSchema), bookingsController.addInternalReservation);
bookingRoutes.delete('/internal-reservations/:reservationId', requireAuth, requirePermission('BOOKINGS', 'EDIT'), bookingsController.removeInternalReservation);

// Availability calendar (members + admins; admin sees internal reservation details)
bookingRoutes.get('/items/:itemId/availability', requireAuth, validate(availabilityQuerySchema), bookingsController.availabilityCalendar);

// Member flow
bookingRoutes.post('/', requireAuth, validate(submitBookingSchema), bookingsController.submitBooking);
bookingRoutes.get('/my', requireAuth, validate(myBookingsQuerySchema), bookingsController.myBookings);
bookingRoutes.get('/:bookingId', requireAuth, bookingsController.getBooking);
bookingRoutes.post('/:bookingId/payment-proof', requireAuth, validate(submitPaymentProofSchema), bookingsController.submitPaymentProof);

// Admin decisions
bookingRoutes.post('/:bookingId/decision', requireAuth, requirePermission('BOOKINGS', 'APPROVE'), validate(bookingDecisionSchema), bookingsController.decideBooking);
bookingRoutes.post('/:bookingId/payment-verification', requireAuth, requirePermission('BOOKINGS', 'APPROVE'), validate(paymentVerificationSchema), bookingsController.verifyPayment);

// Org occupancy / admin listing
bookingRoutes.get('/org/:organizationId', requireAuth, requirePermission('BOOKINGS', 'VIEW'), scopeToOrganization, bookingsController.orgBookings);
