// Historical primary-source register. Prompts are practitioner-authored starters;
// this metadata is not an extracted or complete clause inventory.
const sourceId="afdb_iss_2013_policy";
const cell=summary=>({summary,sourceIds:[sourceId]});
const check=(id,topic,standard,title,prompt,evidence)=>({id,topic,standard,clause:`Operational Safeguard ${standard.slice(2)}`,title,prompt,evidence,sourceIds:[sourceId]});
export const afdb2013Framework={
  id:"afdb_iss_2013",institutionId:"afdb",institution:"AfDB",name:"Integrated Safeguards System",edition:"December 2013",status:"legacy",sourceCheckedAt:"2026-10-23",
  coverage:"Curated starter checks; incomplete. The full original is retained from a dated Internet Archive capture of the exact official AfDB URL. Detailed source proposals remain subject to original-page and professional review; current live-byte equivalence is not claimed.",
  applicability:"Confirm the bank's project-entry date, transition provisions and financing instrument. Later policy publication does not establish this historical project's governing requirements.",
  sources:[{id:sourceId,title:"AfDB Integrated Safeguards System: policy statement and operational safeguards, December 2013",url:"https://www.afdb.org/sites/default/files/documents/policy-documents/december_2013_-_afdbs_integrated_safeguards_system_-_policy_statement_and_operational_safeguards.pdf"}],
  checks:[
    check("afdb2013_os1_assessment","assessment","OS1","Assessment","Are assessment scope, consultation and management responsibilities evidenced?",["ESIA","Management plan"]),
    check("afdb2013_os2_displacement","land","OS2","Displacement","Are compensation and livelihood outcomes evidenced?",["Resettlement plan","Outcome monitoring"]),
    check("afdb2013_os3_biodiversity","biodiversity","OS3","Biodiversity","Are biodiversity and ecosystem-service risks addressed?",["Habitat assessment","Mitigation evidence"]),
    check("afdb2013_os4_pollution","pollution","OS4","Pollution and resources","Are pollution, hazardous-material and resource controls evidenced?",["Monitoring records","Waste inventory"]),
    check("afdb2013_os5_labor","labor","OS5","Labor and safety","Are worker conditions and safety protections demonstrated?",["Employment records","Safety evidence"])
  ],
  comparison:{
    applicability:cell("Dated project-entry and financing scope."),assessment:cell("OS1 assessment and management."),labor:cell("OS5 worker protections."),engagement:cell("OS1 consultation and disclosure."),land:cell("OS2 displacement and compensation."),indigenous:cell("Confirm vulnerability and eligibility within OS1."),biodiversity:cell("OS3 biodiversity and ecosystem services."),climate:cell("Check OS1 screening and OS4 emissions."),pollution:cell("OS4 pollution and resource controls."),health_safety:cell("OS5 workers; verify community-risk scope."),cultural_heritage:cell("Verify heritage scope within OS1 assessment."),financial_intermediaries:cell("Verify intermediary scope within OS1.")
  }
};
