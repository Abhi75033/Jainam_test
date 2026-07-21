import { Member, MemberPrivacySetting } from '@prisma/client';

/** §5.2 privacy rule: "Other members can only ever see name + city/state of a member." */
export function serializeMemberPublic(member: Member) {
  const address = member.currentAddress as { city?: string; state?: string } | null;
  return {
    publicId: member.publicId,
    fullName: member.fullName,
    photoUrl: member.photoUrl,
    city: address?.city ?? null,
    state: address?.state ?? null,
  };
}

/** Fuller view for the owning member themselves, or an admin with MEMBERS:VIEW in their org. */
export function serializeMemberFull(member: any, privacy?: MemberPrivacySetting | null) {
  return {
    publicId: member.publicId,
    category: member.category,
    firstName: member.firstName,
    middleName: member.middleName,
    surname: member.surname,
    fullName: member.fullName,
    photoUrl: member.photoUrl,
    gender: member.gender,
    dob: member.dob,
    nationality: member.nationality,
    preferredLanguage: member.preferredLanguage,
    maritalStatus: member.maritalStatus,
    motherTongue: member.motherTongue,
    communityId: member.communityId,
    subCommunityId: member.subCommunityId,
    gacchaId: member.gacchaId,
    tithiCalendarTypeId: member.tithiCalendarTypeId,
    mobile: privacy?.showMobile === false ? undefined : member.mobile,
    whatsapp: member.whatsapp,
    email: member.email,
    currentAddress: privacy?.showAddress === false ? undefined : member.currentAddress,
    permanentAddress: privacy?.showAddress === false ? undefined : member.permanentAddress,
    nativeVillage: member.nativeVillage,
    bloodGroup: member.bloodGroup,
    disability: member.disability,
    medicalNotes: member.medicalNotes,
    emergencyContact: member.emergencyContact,
    profession: member.profession,
    isVolunteer: member.isVolunteer,
    status: member.status,
    profileCompletionPct: member.profileCompletionPct,
    currencyCode: member.currencyCode,
    createdAt: member.createdAt,
    familyMembers: member.familyMembers?.map((fm: any) => ({
      id: fm.id,
      fullName: fm.relatedMember?.fullName || fm.relatedMember?.firstName || '',
      relationship: fm.relationshipType?.name || fm.relationshipTypeId,
      mobile: fm.relatedMember?.mobile || '',
    })) || [],
  };
}
