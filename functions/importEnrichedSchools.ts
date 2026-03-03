import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import Papa from 'npm:papaparse@5.4.1';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Only admins can import schools
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { fileUrl } = await req.json();
    
    if (!fileUrl) {
      return Response.json({ error: 'fileUrl is required' }, { status: 400 });
    }

    console.log('[IMPORT] Fetching CSV from:', fileUrl);
    
    // Fetch the CSV file
    const csvResponse = await fetch(fileUrl);
    if (!csvResponse.ok) {
      throw new Error(`Failed to fetch CSV: ${csvResponse.status}`);
    }
    
    const csvText = await csvResponse.text();
    
    // Parse CSV
    const result = Papa.parse(csvText, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true
    });
    
    if (result.errors.length > 0) {
      console.error('[IMPORT] CSV parse errors:', result.errors);
      return Response.json({ 
        error: 'CSV parse error', 
        details: result.errors 
      }, { status: 400 });
    }

    const data = result.data;
    console.log('[IMPORT] Parsed', data.length, 'schools from CSV');

    // Transform CSV data to match School entity schema
    const schools = data.map((row) => {
      // Handle 'id' field separately - only include if present and not empty
      const schoolData = {};
      if (row.id && row.id.trim()) {
        schoolData.id = row.id.trim();
      }
      
      Object.assign(schoolData, {
        name: row.name?.trim(),
        slug: row.slug?.trim(),
        address: row.address?.trim() || undefined,
        city: row.city?.trim(),
        provinceState: row.provinceState?.trim(),
        country: row.country?.trim(),
        region: row.region?.trim(),
        lat: row.lat ? parseFloat(row.lat) : undefined,
        lng: row.lng ? parseFloat(row.lng) : undefined,
        lowestGrade: row.lowestGrade ? parseInt(row.lowestGrade) : undefined,
        highestGrade: row.highestGrade ? parseInt(row.highestGrade) : undefined,
        gradeSystem: row.gradeSystem || undefined,
        enrollment: row.enrollment ? parseInt(row.enrollment) : undefined,
        avgClassSize: row.avgClassSize ? parseInt(row.avgClassSize) : undefined,
        studentTeacherRatio: row.studentTeacherRatio?.trim() || undefined,
        acceptanceRate: row.acceptanceRate ? parseInt(row.acceptanceRate) : undefined,
        internationalStudentPct: row.internationalStudentPct ? parseInt(row.internationalStudentPct) : undefined,
        schoolType: row.schoolType?.trim() || 'General',
        boardingAvailable: row.boardingAvailable === 'true',
        boardingType: row.boardingType?.trim() || undefined,
        genderPolicy: row.genderPolicy?.trim() || undefined,
        religiousAffiliation: row.religiousAffiliation?.trim() || undefined,
        uniformRequired: row.uniformRequired === 'true',
        campusFeel: row.campusFeel?.trim() || undefined,
        founded: row.founded ? parseInt(row.founded) : undefined,
        curriculumType: row.curriculumType?.trim() || undefined,
        curriculum: row.curriculum ? JSON.parse(row.curriculum) : [],
        specializations: row.specializations ? JSON.parse(row.specializations) : [],
        artsPrograms: row.artsPrograms ? JSON.parse(row.artsPrograms) : [],
        sportsPrograms: row.sportsPrograms ? JSON.parse(row.sportsPrograms) : [],
        clubs: row.clubs ? JSON.parse(row.clubs) : [],
        languages: row.languages ? JSON.parse(row.languages) : [],
        specialEdPrograms: row.specialEdPrograms ? JSON.parse(row.specialEdPrograms) : [],
        tuition: row.tuition ? parseInt(row.tuition) : undefined,
        dayTuition: row.dayTuition ? parseInt(row.dayTuition) : undefined,
        boardingTuition: row.boardingTuition ? parseInt(row.boardingTuition) : undefined,
        tuitionMin: row.tuitionMin ? parseInt(row.tuitionMin) : undefined,
        tuitionMax: row.tuitionMax ? parseInt(row.tuitionMax) : undefined,
        currency: row.currency?.trim() || 'CAD',
        financialAidAvailable: row.financialAidAvailable === 'true',
        financialAidDetails: row.financialAidDetails?.trim() || undefined,
        scholarshipsJson: row.scholarshipsJson?.trim() || undefined,
        tuitionNotes: row.tuitionNotes?.trim() || undefined,
        missionStatement: row.missionStatement?.trim() || undefined,
        description: row.description?.trim() || undefined,
        teachingPhilosophy: row.teachingPhilosophy?.trim() || undefined,
        values: row.values ? JSON.parse(row.values) : [],
        highlights: row.highlights ? JSON.parse(row.highlights) : [],
        communityVibe: row.communityVibe?.trim() || undefined,
        parentInvolvement: row.parentInvolvement?.trim() || undefined,
        diversityStatement: row.diversityStatement?.trim() || undefined,
        safetyPolicies: row.safetyPolicies?.trim() || undefined,
        applicationDeadline: row.applicationDeadline?.trim() || undefined,
        admissionRequirements: row.admissionRequirements ? JSON.parse(row.admissionRequirements) : [],
        entranceRequirements: row.entranceRequirements?.trim() || undefined,
        openHouseDates: row.openHouseDates ? JSON.parse(row.openHouseDates) : [],
        universityPlacements: row.universityPlacements?.trim() || undefined,
        website: row.website?.trim() || undefined,
        phone: row.phone?.trim() || undefined,
        email: row.email?.trim() || undefined,
        logoUrl: row.logoUrl?.trim() || undefined,
        headerPhotoUrl: row.headerPhotoUrl?.trim() || undefined,
        heroImage: row.heroImage?.trim() || undefined,
        photoGallery: row.photoGallery ? JSON.parse(row.photoGallery) : [],
        videos: row.videos ? JSON.parse(row.videos) : [],
        virtualTourUrl: row.virtualTourUrl?.trim() || undefined,
        facilities: row.facilities ? JSON.parse(row.facilities) : [],
        accreditations: row.accreditations ? JSON.parse(row.accreditations) : [],
        transportationOptions: row.transportationOptions?.trim() || undefined,
        beforeAfterCare: row.beforeAfterCare?.trim() || undefined,
        campusSize: row.campusSize?.trim() || undefined,
        languageOfInstruction: row.languageOfInstruction?.trim() || undefined,
        gradesServed: row.gradesServed?.trim() || undefined,
        status: row.status?.trim() || 'active',
        verified: row.verified === 'true',
        claimStatus: row.claimStatus?.trim() || 'unclaimed',
        membershipTier: row.membershipTier?.trim() || 'basic',
        subscriptionTier: row.subscriptionTier?.trim() || 'free',
        dataSource: row.dataSource?.trim() || undefined,
        governmentId: row.governmentId?.trim() || undefined,
        importBatchId: row.importBatchId?.trim() || 'enriched_v4_clean_feb2026',
        aiEnrichedFields: row.aiEnrichedFields ? JSON.parse(row.aiEnrichedFields) : [],
        completenessScore: row.completenessScore ? parseFloat(row.completenessScore) : undefined,
        source: row.source?.trim() || undefined,
        adminUserId: row.adminUserId?.trim() || undefined,
        lastEnriched: row.lastEnriched?.trim() || undefined,
        is_sample: row.is_sample === 'True' || row.is_sample === 'true',
        verifiedFields: row.verifiedFields?.trim() || undefined
      };

      // Remove undefined values
      Object.keys(schoolData).forEach(key => schoolData[key] === undefined && delete schoolData[key]);
      
      return schoolData;
    });

    console.log('[IMPORT] Transformed', schools.length, 'schools');

    // Bulk create/update schools with retry logic
    let created = 0;
    let updated = 0;
    let errors = [];

    const retryWithBackoff = async (fn, maxRetries = 5) => {
      for (let i = 0; i < maxRetries; i++) {
        try {
          return await fn();
        } catch (e) {
          if (e.message?.includes('Rate limit') && i < maxRetries - 1) {
            const delay = Math.pow(2, i) * 2000; // 2s, 4s, 8s, 16s, 32s
            console.log(`[RETRY] Waiting ${delay}ms before retry ${i + 1}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw e;
          }
        }
      }
    };

    for (const school of schools) {
      try {
        // Throttle requests to avoid rate limits (200ms between each)
        await new Promise(resolve => setTimeout(resolve, 200));

        // Try to find existing school by slug or id
        let existing = null;
        if (school.id) {
          const results = await base44.entities.School.filter({ id: school.id });
          existing = results.length > 0 ? results[0] : null;
        } else if (school.slug) {
          const results = await base44.entities.School.filter({ slug: school.slug });
          existing = results.length > 0 ? results[0] : null;
        }

        if (existing) {
          await retryWithBackoff(() => base44.entities.School.update(existing.id, school));
          updated++;
        } else {
          await retryWithBackoff(() => base44.entities.School.create(school));
          created++;
        }
      } catch (e) {
        console.error('[IMPORT ERROR]', school.name, e.message);
        errors.push({ school: school.name, error: e.message });
      }
    }

    console.log('[IMPORT COMPLETE]', { created, updated, errors: errors.length });

    return Response.json({
      success: true,
      created,
      updated,
      total: schools.length,
      errors: errors.length > 0 ? errors : null
    });

  } catch (error) {
    console.error('[IMPORT FATAL]', error);
    return Response.json({ 
      error: error.message || 'Import failed' 
    }, { status: 500 });
  }
});