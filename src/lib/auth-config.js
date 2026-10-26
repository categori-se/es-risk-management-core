// Community profile: hosted identity requires an independently configured adapter.
export const cognitoAuthConfig=Object.freeze({region:'',userPoolId:'',clientId:'',hostedUiDomain:'',redirectUri:'http://127.0.0.1:4173/',logoutUri:'http://127.0.0.1:4173/',scopes:['openid','email','profile'],localRedirectUris:[]});
export function getCognitoAuthConfig(){return cognitoAuthConfig;}
