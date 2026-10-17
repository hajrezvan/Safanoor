const deadline=Date.now()+120000;
for(const url of ['http://localhost:3001/api/v1/health','http://localhost:3033/auth/jwt/sign-in']){
 let ready=false;
 while(Date.now()<deadline){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}
 if(!ready)throw new Error(`Server did not become ready: ${url}`);
}
