import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all schools with null/empty website
    const allSchools = await base44.asServiceRole.entities.School.list('-created_at', 5000);
    
    const schoolsNeedingWebsite = allSchools.filter(s => !s.website);
    
    console.log(`Found ${schoolsNeedingWebsite.length} schools needing website update`);

    // Domain generation mapping for known schools
    const knownDomains = {
      'lower canada college': 'lcc.ca',
      'selwyn house': 'selwynhouse.ca',
      'trafalgar school': 'trafalgar.qc.ca',
      'villa sainte-marcelline': 'villasmm.ca',
      'marianopolis college': 'marianopolis.qc.ca',
      'ecole bilingue notre-dame': 'ecole-bilingue.qc.ca',
      'st. thomas high school': 'stthomas.qc.ca',
      'west island college': 'westislandcollege.ca',
      'sacred heart school': 'shsmontreal.com',
      'centennial academy': 'centennialacademy.ca',
      'the priory school': 'prioryscho.ca',
      'alexander von humboldt': 'avh.ca',
      'herzliah': 'herzliah.ca',
      'hebrew academy': 'hebrewacademy.ca',
      'solomon schechter': 'schechter.ca',
      'john rennie high school': 'jrhs.ca',
      'the bishop strachan': 'bss.on.ca',
      'branksome hall': 'branksome.on.ca',
      'crescent school': 'crescentschool.org',
      'havergal college': 'havergal.on.ca',
      'st. andrew\'s college': 'sac.on.ca',
      'appleby college': 'appleby.on.ca',
      'ridley college': 'ridleycollege.com',
      'trinity college school': 'tcs.on.ca',
      'lakefield college': 'lcs.on.ca',
      'albert college': 'albertcollege.ca',
      'shawnigan lake': 'shawnigan.ca',
      'brentwood college': 'brentwood.bc.ca',
      'st. michaels university': 'smus.ca',
      'bodwell high': 'bodwell.edu',
      'crofton house': 'croftonhouse.ca',
      'york house': 'yorkhouse.ca',
      'st. george\'s school': 'stgeorges.ca',
      'west point grey': 'westpointgrey.ca',
      'stratford hall': 'stratford.ca',
      'meadowridge': 'meadowridge.ca',
      'southridge': 'southridge.ca',
      'mulgrave': 'mulgrave.ca',
      'fraser academy': 'fraserbc.ca',
      'urban academy': 'urbanacademy.ca',
      'dwight school': 'dwightschool.ca',
      'rothesay netherwood': 'rns.ca',
      'king\'s-edgehill': 'kes.ns.ca',
    };

    const updates = [];
    let successCount = 0;
    let skipCount = 0;

    for (const school of schoolsNeedingWebsite) {
      let domain = null;

      // Try to match against known domains
      const schoolNameLower = school.name.toLowerCase();
      for (const [key, value] of Object.entries(knownDomains)) {
        if (schoolNameLower.includes(key)) {
          domain = value;
          break;
        }
      }

      // If no known domain, generate from school name and city
      if (!domain) {
        // Create domain from school name: remove special chars, replace spaces with hyphens
        let baseDomain = school.name
          .toLowerCase()
          .replace(/[&]/g, 'and')
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');

        // Add common Canadian TLDs based on province
        let tld = 'ca';
        if (school.province_state) {
          const prov = school.province_state.toLowerCase();
          if (prov.includes('quebec')) tld = 'qc.ca';
          else if (prov.includes('ontario')) tld = 'on.ca';
          else if (prov.includes('british')) tld = 'bc.ca';
          else if (prov.includes('alberta')) tld = 'ab.ca';
        }

        domain = `${baseDomain}.${tld}`;
      }

      // Skip if domain generation failed
      if (!domain || domain.length < 5) {
        skipCount++;
        continue;
      }

      const website = `https://www.${domain}`;
      const heroImage = `https://logo.clearbit.com/${domain}`;

      try {
        await base44.asServiceRole.entities.School.update(school.id, {
          website,
          heroImage
        });
        successCount++;
        updates.push({ name: school.name, domain });
      } catch (error) {
        console.error(`Failed to update ${school.name}:`, error.message);
      }
    }

    return Response.json({
      success: true,
      message: `Updated ${successCount} schools, skipped ${skipCount}`,
      updated: updates,
      totalProcessed: schoolsNeedingWebsite.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});