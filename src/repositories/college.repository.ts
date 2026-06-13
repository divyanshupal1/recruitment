import { collegesCollection } from '../lib/firebase.js';
import type { College, PredictionConstraints } from '../types/college.js';

export const collegeRepository = {
  /**
   * Queries colleges from Firestore with server-side filters where possible,
   * then applies remaining filters (region partial match, degree membership)
   * on the client side.
   *
   * Firestore-side filters:
   *   - drive_support.<job_type> == true
   *   - branches array-contains <required_branch>
   *
   * Client-side filters (Firestore can't handle these natively):
   *   - region_query partial string match (city / state / region)
   *   - degrees array membership (only one array-contains allowed per query)
   */
  async findByConstraints(constraints: PredictionConstraints): Promise<College[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = collegesCollection;

    // 1. Job type support — push to Firestore as equality filter
    if (constraints.job_type) {
      const jobTypeField = `drive_support.${constraints.job_type.toLowerCase()}`;
      query = query.where(jobTypeField, '==', true);
    }

    // 2. Branch membership — push to Firestore as array-contains
    //    (Firestore allows only ONE array-contains per query, so we use it for branches)
    if (constraints.required_branch) {
      query = query.where('branches', 'array-contains', constraints.required_branch);
    }

    const snapshot = await query.get();
    let results = snapshot.docs.map((doc: FirebaseFirestore.DocumentSnapshot) => doc.data() as College);

    console.log(`[CollegeRepo] Firestore returned ${results.length} docs (server-side filters applied).`);

    // 3. Region partial match — client-side (Firestore has no substring/LIKE operator)
    const regionQuery = constraints.region_query?.toLowerCase();
    if (regionQuery && regionQuery !== 'any') {
      results = results.filter((c: College) => {
        const loc = c.location;
        if (!loc) return false;
        return (
          loc.city?.toLowerCase().includes(regionQuery) ||
          loc.state?.toLowerCase().includes(regionQuery) ||
          loc.region?.toLowerCase().includes(regionQuery)
        );
      });
    }

    // 4. Degree membership — client-side (already used array-contains for branches)
    if (constraints.required_degree) {
      results = results.filter((c: College) => c.degrees?.includes(constraints.required_degree));
    }

    console.log(`[CollegeRepo] After client-side filters: ${results.length} colleges.`);
    return results;
  },
};
