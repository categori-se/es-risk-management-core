// Edition-specific original review prompts authored for ESIA. These are a
// navigation and review starting point, never a complete institutional inventory.
const afdbSource='afdb2023',ebrdSource='ebrd2024';
const check=(prefix,source,number,topic,title,prompt,evidence)=>({id:`${prefix}_${number}`,topic,standard:`${prefix==='afdb2023'?'OS':'ESR'}${number}`,clause:'Scope and requirements; verify exact paragraph in retained original',title,prompt,evidence,sourceIds:[source]});
const common=[
  [1,'assessment','Assessment and management','Are project boundaries, alternatives, risks, management commitments, resources, contractor responsibilities and monitoring evidence appropriate to this edition?',['ESIA and alternatives','ESMS','Action plan and monitoring evidence']],
  [2,'labor','Labor and working conditions','Are employment conditions, worker representation and grievances, child and forced labor, contractors and supply-chain controls assessed under the applicable scope?',['Employment and contractor records','Worker interviews','Worker grievance records']],
  [3,'pollution','Resources and pollution','Are resource efficiency, emissions, wastewater, waste and hazardous-material controls supported by applicable limits, methods and dated evidence?',['Resource and emissions inventory','Permit and technical-limit review','Monitoring results']],
  [4,'health_safety','Health, safety and security','Are the edition-specific worker and community health, safety, emergency and security responsibilities identified and assessed?',['Health and safety assessment','Emergency response records','Security arrangements']],
  [5,'land','Land and livelihoods','Are land restrictions, physical and economic displacement, eligibility, replacement-cost compensation and livelihood restoration outcomes assessed before closure?',['Census and asset inventory','Entitlements and compensation','Livelihood outcome monitoring']],
  [6,'biodiversity','Biodiversity and living resources','Are habitat classification, ecosystem services, mitigation hierarchy and living-resource controls supported by specialist baseline and outcome evidence?',['Habitat and critical-habitat assessment','Biodiversity management and monitoring']],
  [8,'cultural_heritage','Cultural heritage','Are tangible and intangible heritage, access, consultation, chance finds and commercial-use conditions evaluated against this edition?',['Heritage baseline','Consultation records','Chance-find procedure']],
  [9,'financial_intermediaries','Financial intermediaries','Are the intermediary system, financing scope, delegated responsibilities, subproject screening, exclusions and monitoring demonstrated?',['FI ESMS and capacity','Portfolio and subproject records','Monitoring reports']],
  [10,'engagement','Stakeholder engagement','Are timely disclosure, inclusive meaningful consultation, continuing engagement, grievances and reprisal risks assessed throughout the project lifecycle?',['Stakeholder engagement plan','Disclosure and consultation record','Grievance and safe-feedback evidence']]
];
const comparisons=(source,prefix)=>Object.fromEntries([
  ['applicability','Confirm the project transition rule and financing contract.'],['assessment',`${prefix}1 assessment and management.`],['labor',`${prefix}2 worker conditions; confirm health and safety allocation.`],
  ['pollution',`${prefix}3 resources and pollution.`],['health_safety',`${prefix}4 health, safety and security.`],['engagement',`${prefix}10 engagement and disclosure.`],['land',`${prefix}5 land restrictions and displacement.`],
  ['indigenous',prefix==='OS'?'OS7 vulnerable groups; do not assume equivalence to another lender’s Indigenous Peoples test.':'ESR7 Indigenous Peoples; confirm eligibility and conditional consent requirements.'],
  ['biodiversity',`${prefix}6 biodiversity and living resources.`],['cultural_heritage',`${prefix}8 cultural heritage.`],['climate',`${prefix}1 risk assessment and ${prefix}3 emissions; confirm edition-specific scope and thresholds.`],['financial_intermediaries',`${prefix}9 intermediary system and portfolio responsibilities.`]
].map(([key,summary])=>[key,{summary,sourceIds:[source]}]));

export const currentAfdbEbrdFrameworks=[{
  id:'afdb_iss_2023',institutionId:'afdb',institution:'AfDB',name:'Integrated Safeguards System',edition:'Approved April 2023; effective 31 May 2024',status:'current',sourceCheckedAt:'2026-10-23',
  coverage:'Curated starter checks; incomplete. Exact current-policy PDF capture remains unavailable; no detailed corpus has been prepared. Borrower guidance does not replace mandatory policy requirements.',
  applicability:'The 2023 ISS became effective on 31 May 2024. Confirm the financing instrument and transition arrangements; never replace the 2013 edition in a retained engagement automatically.',
  sources:[{id:afdbSource,title:'AfDB 2023 Integrated Safeguards System: official publication',url:'https://www.afdb.org/en/documents/african-development-bank-groups-integrated-safeguards-system-2023'},
    {id:'afdb2023_effective',title:'AfDB official notice: updated ISS effective 31 May 2024',url:'https://www.afdb.org/en/news-and-events/press-releases/african-development-bank-groups-updated-integrated-safeguards-system-iss-becomes-effective-71539'},
    {id:'afdb2023_guidance',title:'AfDB borrower guidance: identifies OS1–10; guidance is not mandatory policy text',url:'https://www.afdb.org/en/documents/borrower-guidance-note'}],
  checks:[...common.map(args=>check('afdb2023',afdbSource,...args)),check('afdb2023',afdbSource,7,'indigenous','Vulnerable groups','Are vulnerable-group characteristics, exclusion risks, differentiated measures and any additional consultation requirements established using AfDB OS7 definitions?',['Vulnerability assessment','Differentiated mitigation and consultation evidence'])].sort((a,b)=>Number(a.standard.slice(2))-Number(b.standard.slice(2))),
  comparison:comparisons(afdbSource,'OS')
},{
  id:'ebrd_esp_2024',institutionId:'ebrd',institution:'EBRD',name:'Environmental and Social Policy and Environmental and Social Requirements',edition:'October 2024; effective 1 January 2025',status:'current',sourceCheckedAt:'2026-10-23',
  coverage:'Curated starter checks; incomplete. Full original retained and extracted; repeated PDF text layers, paragraph reading order and source-derived definitions require review.',
  applicability:'Section VI retains the policy in force when Bank management gave initial project approval. Section VII makes this edition effective on 1 January 2025. Do not replace historical 2014 or 2019 project requirements automatically.',
  sources:[{id:ebrdSource,title:'EBRD Environmental and Social Policy October 2024, official PDF',url:'https://www.ebrd.com/content/dam/ebrd_dxp/assets/pdfs/environment---sustainability/environmental-and-social-policy-esp/esp-2024/EBRD-Environmental-and-Social-Policy-2024-high-res.pdf',sha256:'7e790aef339dd99c3da49ae418475d47a83b592b3882a070b7d626b6815d51f4'}],
  checks:[...common.map(args=>check('ebrd2024',ebrdSource,...args)),check('ebrd2024',ebrdSource,7,'indigenous','Indigenous Peoples','Are Indigenous Peoples eligibility, impacts, meaningful consultation and the edition-specific circumstances requiring free, prior and informed consent evidenced?',['Eligibility and impacts assessment','Consultation and conditional consent records'])].sort((a,b)=>Number(a.standard.slice(3))-Number(b.standard.slice(3))),
  comparison:comparisons(ebrdSource,'ESR')
}];
