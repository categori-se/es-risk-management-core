// Native application Teams retain their normal membership and grants.
// Cross-application canonical correspondences require a customer-owned adapter.
export async function mappedTeamEligibility({canonicalTeamId,fail}){if(canonicalTeamId===undefined)return{eligible:true,until:Infinity,mapped:false};fail(503,'No customer shared Team registry adapter is configured.');}
