// Function: generateComparison
// Purpose: Generate AI-powered school comparison matrix and insights, with premium content gating
// Entities: School, FamilyProfile, GeneratedArtifact, User, FamilyJourney
// Last Modified: 2026-03-06

import { School, FamilyProfile, GeneratedArtifact, User, FamilyJourney } from '@/lib/entities-server'

export async function generateComparisonLogic(params: { schoolIds: string[]; familyProfileId?: string; userId?: string }) {
  const { schoolIds, familyProfileId, userId } = params;

  if (!schoolIds || schoolIds.length < 2 || schoolIds.length > 3) {
    throw Object.assign(new Error('Provide 2-3 school IDs'), { status: 400 });
  }

  // E24-S3-WC1: Resolve user tier for premium content gating
  let isPremiumUser = false;
  if (userId) {
    try {
      const userRecords = await User.filter({ id: userId });
      const userTier = userRecords?.[0]?.tier || 'free';
      isPremiumUser = userTier === 'premium';
      console.log('[E24-S3-WC1] userId:', userId, 'tier:', userTier, 'isPremium:', isPremiumUser);
    } catch (tierErr: any) {
      console.warn('[E24-S3-WC1] Failed to fetch user tier (defaulting to free):', tierErr.message);
    }
  }

  // Fetch schools
  const schools = await Promise.all(
    schoolIds.map((id: string) => School.filter({ id }).then((arr: any[]) => arr[0]))
  );

  // Fetch FamilyProfile if provided
  let familyProfile: any = null;
  if (familyProfileId) {
    try {
      const profiles = await FamilyProfile.filter({ id: familyProfileId });
      familyProfile = profiles?.[0] || null;
    } catch (e: any) { console.warn('[COMPARISON] FamilyProfile fetch failed:', e.message); }
  }

  // E29-016: Fetch active FamilyJourney for journey insights
  let activeJourney: any = null;
  let schoolJourneys: any[] = [];
  if (userId) {
    try {
      const journeys = await FamilyJourney.filter({ userId });
      activeJourney = journeys?.find((j: any) => !j.isArchived) || null;
      if (activeJourney?.schoolJourneys) {
        schoolJourneys = Array.isArray(activeJourney.schoolJourneys) ? activeJourney.schoolJourneys : JSON.parse(activeJourney.schoolJourneys);
      }
      console.log('[E29-016] FamilyJourney fetched:', activeJourney?.id, 'schoolJourneys count:', schoolJourneys.length);
    } catch (journeyErr: any) {
      console.warn('[E29-016] FamilyJourney fetch failed:', journeyErr.message);
    }
  }

  // Build comparison structure
  const comparison: any = {
    schools: schools.map((s: any) => ({
      id: s.id,
      name: s.name,
      heroImage: s.headerPhotoUrl || s.heroImage || null,
      city: s.city,
      region: s.region
    })),
    categories: [
      {
        name: 'Basic Info',
        rows: [
          { label: 'Location', values: schools.map((s: any) => `${s.city}, ${s.provinceState}`) },
          { label: 'Grades', values: schools.map((s: any) => s.gradesServed || (s.lowestGrade && s.highestGrade ? s.lowestGrade + '-' + s.highestGrade : 'N/A')) },
          { label: 'Enrollment', values: schools.map((s: any) => s.enrollment?.toLocaleString()) },
          { label: 'Founded', values: schools.map((s: any) => s.founded) },
          { label: 'Curriculum', values: schools.map((s: any) => s.curriculum) }
        ]
      },
      {
        name: 'Academics',
        rows: [
          { label: 'Avg Class Size', values: schools.map((s: any) => s.avgClassSize) },
          { label: 'Student:Teacher', values: schools.map((s: any) => s.studentTeacherRatio) },
          { label: 'Specializations', values: schools.map((s: any) => s.specializations?.join(', ') || 'None') }
        ]
      },
      {
        name: 'Cost',
        rows: [
          { label: 'Annual Tuition', values: schools.map((s: any) => `${s.currency} ${s.tuition?.toLocaleString()}`) },
          { label: 'Financial Aid', values: schools.map((s: any) => s.financialAidAvailable ? 'Available' : 'Not available') }
        ]
      },
      {
        name: 'Programs',
        rows: [
          { label: 'Arts', values: schools.map((s: any) => s.artsPrograms?.slice(0, 3).join(', ') || 'None') },
          { label: 'Sports', values: schools.map((s: any) => s.sportsPrograms?.slice(0, 3).join(', ') || 'None') },
          { label: 'Languages', values: schools.map((s: any) => s.languages?.join(', ') || 'None') }
        ]
      }
    ]
  };

  // E29-016: Add Journey Insights category for premium users
  if (isPremiumUser && activeJourney && schoolJourneys.length > 0) {
    const journeyRows = [
      { label: 'Post-Visit Fit', values: schools.map((s: any) => { const sj = schoolJourneys.find((j: any) => j.schoolId === s.id); return sj?.postVisitFitLabel || 'Not yet visited'; }) },
      { label: 'Visit Verdict', values: schools.map((s: any) => { const sj = schoolJourneys.find((j: any) => j.schoolId === s.id); return sj?.visitVerdict || 'Pending'; }) },
      { label: 'Fit Direction', values: schools.map((s: any) => { const sj = schoolJourneys.find((j: any) => j.schoolId === s.id); return sj?.fitDirection || '-'; }) },
      { label: 'Key Strengths', values: schools.map((s: any) => { const sj = schoolJourneys.find((j: any) => j.schoolId === s.id); return (sj?.revisedStrengths || []).join(', ') || 'TBD'; }) },
      { label: 'Open Concerns', values: schools.map((s: any) => { const sj = schoolJourneys.find((j: any) => j.schoolId === s.id); return (sj?.revisedConcerns || []).join(', ') || 'None'; }) },
      { label: 'Status', values: schools.map((s: any) => { const sj = schoolJourneys.find((j: any) => j.schoolId === s.id); return sj?.status || 'MATCHED'; }) }
    ];
    comparison.categories.push({ name: 'Journey Insights', rows: journeyRows });
    console.log('[E29-016] Journey Insights category added for premium user');
  }

  // Generate AI insights
  // TODO: Replace with your LLM call implementation
  let insights: any = { insights: [] };
  console.log('[E25-S5] LLM insights placeholder - implement with your LLM service');

  // Build family-personalized comparisonMatrix
  const priorities = familyProfile?.priorities || [];
  const dealbreakers = familyProfile?.dealbreakers || [];
  const prioritySet = new Set(priorities.map((p: string) => p.toLowerCase()));

  const comparisonMatrix: any = {
    schools: comparison.schools,
    dimensions: comparison.categories.flatMap((cat: any) => {
      if (cat.name === 'Journey Insights') {
        return cat.rows.map((row: any) => ({ category: cat.name, label: row.label, values: row.values }));
      }
      return cat.rows.map((row: any) => ({
        category: cat.name,
        label: row.label,
        values: row.values,
        relevance: (() => { const label = row.label.toLowerCase(); const isP = [...prioritySet].some((p: string) => label.includes(p) || p.includes(label) || label.split(' ').some((w: string) => p.includes(w))); return isP ? 'priority' : null; })()
          || (dealbreakers?.some((d: string) => { const label = row.label.toLowerCase(); const db = d.toLowerCase(); return label.includes(db) || db.includes(label) || db.split(' ').some((w: string) => w.length > 3 && label.includes(w)); }) ? 'dealbreaker' : 'neutral')
      }));
    })
  };

  // E24-S3-WC1: Gate premium content for non-premium users
  let finalInsights = insights.insights;
  let isLocked = false;
  let tradeoffNarration: any = null;

  if (!isPremiumUser) {
    finalInsights = null;
    comparisonMatrix.dimensions = comparisonMatrix.dimensions.map(({ relevance, ...rest }: any) => rest);
    isLocked = true;
    console.log('[E24-S3-WC1] Comparison insights and relevance tags gated for non-premium user');
  }

  comparison.insights = finalInsights;

  // Persist to GeneratedArtifact (non-blocking)
  if (familyProfileId) {
    try {
      const artifactKey = [...schoolIds].sort().join('_');
      const existing = await GeneratedArtifact.filter({
        familyProfileId,
        artifactType: 'comparison'
      });
      const found = existing?.find((a: any) => a.artifactKey === artifactKey);

      const artifactData: any = {
        familyProfileId,
        artifactType: 'comparison',
        artifactKey,
        content: {
          comparisonMatrix,
          insights: finalInsights,
          isLocked,
          tradeoffNarration
        },
        generatedAt: new Date().toISOString()
      };

      if (found) {
        await GeneratedArtifact.update(found.id, artifactData);
        console.log('[COMPARISON] GeneratedArtifact updated:', found.id);
      } else {
        const created = await GeneratedArtifact.create(artifactData);
        console.log('[COMPARISON] GeneratedArtifact created:', created.id);
      }
    } catch (persistError: any) {
      console.error('[COMPARISON] GeneratedArtifact persistence failed (non-blocking):', persistError.message);
    }
  }

  return {
    ...comparison,
    comparisonMatrix,
    isLocked,
    journeyPhase: activeJourney?.currentPhase || null,
    tradeoffNarration
  };
}
