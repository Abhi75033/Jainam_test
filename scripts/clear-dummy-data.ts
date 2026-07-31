import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDummyData() {
  console.log('🧹 Starting cleanup of non-login dummy data from database...');

  // 1. Bookings & Accommodation Operations
  await prisma.bookingStatusHistory.deleteMany({}).catch(() => {});
  await prisma.receipt.deleteMany({}).catch(() => {});
  await prisma.booking.deleteMany({}).catch(() => {});
  await prisma.bookingItem.deleteMany({}).catch(() => {});
  await prisma.roomOrHall.deleteMany({}).catch(() => {});
  await prisma.wing.deleteMany({}).catch(() => {});
  await prisma.building.deleteMany({}).catch(() => {});

  // 2. Donations
  await prisma.donation.deleteMany({}).catch(() => {});

  // 3. Events & Ticketing
  await prisma.eventTicket.deleteMany({}).catch(() => {});
  await prisma.eventRsvp.deleteMany({}).catch(() => {});
  await prisma.eventSponsor.deleteMany({}).catch(() => {});
  await prisma.event.deleteMany({}).catch(() => {});

  // 4. Feed & Polls
  await prisma.feedComment.deleteMany({}).catch(() => {});
  await prisma.feedLike.deleteMany({}).catch(() => {});
  await prisma.feedBookmark.deleteMany({}).catch(() => {});
  await prisma.feedShare.deleteMany({}).catch(() => {});
  await prisma.pollVote.deleteMany({}).catch(() => {});
  await prisma.pollOption.deleteMany({}).catch(() => {});
  await prisma.poll.deleteMany({}).catch(() => {});
  await prisma.feedPost.deleteMany({}).catch(() => {});

  // 5. Community Pages
  await prisma.communityPageMember.deleteMany({}).catch(() => {});
  await prisma.communityPageSubscription.deleteMany({}).catch(() => {});
  await prisma.communityPage.deleteMany({}).catch(() => {});

  // 6. Monks & Vihar Tracking
  await prisma.monkLocationUpdate.deleteMany({}).catch(() => {});
  await prisma.monkViharDailyEntry.deleteMany({}).catch(() => {});
  await prisma.monkViharTour.deleteMany({}).catch(() => {});
  await prisma.monkChaturmasEntry.deleteMany({}).catch(() => {});
  await prisma.monkFollow.deleteMany({}).catch(() => {});
  await prisma.monkProfile.deleteMany({}).catch(() => {});
  await prisma.monkGroup.deleteMany({}).catch(() => {});

  // 7. Organizations & Organization Data
  await prisma.organizationGalleryImage.deleteMany({}).catch(() => {});
  await prisma.organizationContact.deleteMany({}).catch(() => {});
  await prisma.organizationTrustee.deleteMany({}).catch(() => {});
  await prisma.organizationVolunteer.deleteMany({}).catch(() => {});
  await prisma.organizationHistoryEvent.deleteMany({}).catch(() => {});
  await prisma.dhajaRecord.deleteMany({}).catch(() => {});
  await prisma.organizationReview.deleteMany({}).catch(() => {});
  await prisma.organizationNotice.deleteMany({}).catch(() => {});
  await prisma.organizationFollow.deleteMany({}).catch(() => {});
  await prisma.organizationSocialLink.deleteMany({}).catch(() => {});
  await prisma.pathshalaCenter.deleteMany({}).catch(() => {});
  await prisma.userOrganization.deleteMany({}).catch(() => {});
  await prisma.organization.deleteMany({}).catch(() => {});

  // 8. Visitors
  await prisma.visitorLog.deleteMany({}).catch(() => {});
  await prisma.visitor.deleteMany({}).catch(() => {});

  // 9. Support Tickets
  await prisma.supportTicketComment.deleteMany({}).catch(() => {});
  await prisma.supportTicket.deleteMany({}).catch(() => {});

  // 10. Content & Modules (Announcements, Gallery, Volunteers, Offers, News)
  await prisma.announcement.deleteMany({}).catch(() => {});
  await prisma.galleryPhoto.deleteMany({}).catch(() => {});
  await prisma.galleryAlbum.deleteMany({}).catch(() => {});
  await prisma.volunteerAttendance.deleteMany({}).catch(() => {});
  await prisma.volunteerApplication.deleteMany({}).catch(() => {});
  await prisma.volunteerOpportunity.deleteMany({}).catch(() => {});
  await prisma.offer.deleteMany({}).catch(() => {});
  await prisma.newsItem.deleteMany({}).catch(() => {});

  // 11. System Notifications, Audit Logs, Counters
  await prisma.notification.deleteMany({}).catch(() => {});
  await prisma.alertLog.deleteMany({}).catch(() => {});
  await prisma.counterTrackingEntry.deleteMany({}).catch(() => {});

  console.log('✅ Cleaned up all non-login dummy operational data from database.');
  console.log('🔑 Preserved login dummy data (Users, Members, Roles, Master Data).');
}

clearDummyData()
  .catch((err) => {
    console.error('❌ Error clearing dummy data:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
