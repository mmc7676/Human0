/* galaxy-core.js: Space at Scale shared core for the Galaxy scale (SCW4), the calendar, signals and the
   energy + matter ledger. The app and the SCW universe server load this exact file (byte-identical, SHA-256 checked). */
(function(root){
'use strict';
const D2R=Math.PI/180;
// ---- constants (SI: CODATA 2018 / IAU 2015 nominal) ----
const C={c_ms:299792458,c_kms:299792.458,G_si:6.6743e-11,GMsun_si:1.32712440018e20,kpc_m:3.0856775814913673e19,
 ly_m:9.4607304725808e15,au_m:1.495978707e11,yr_s:31557600,Lsun_W:3.828e26,Mearth_kg:5.9722e24,Mjup_kg:1.89813e27};
C.Msun_kg=C.GMsun_si/C.G_si;            // 1.98841e30 kg
C.kpc_kly=C.kpc_m/C.ly_m/1e3;           // 3.2615637769
C.kpc_au=C.kpc_m/C.au_m;                // 206264806.25
C.G=C.GMsun_si/C.kpc_m/1e6;             // 4.30091e-6 kpc (km/s)^2 / Msun
C.kms_kpcMyr=1e9*C.yr_s/C.kpc_m;        // 1.0227122e-3 (kpc/Myr) per (km/s)
C.GM=C.G*C.kms_kpcMyr*C.kms_kpcMyr;     // kpc^3 / (Msun Myr^2)
C.pm_k=C.au_m/1e3/C.yr_s;               // 4.740470 km/s per (mas/yr x kpc)
C.H0=67.4;C.rho_crit=3*(C.H0/1e3)**2/(8*Math.PI*C.G); // Msun/kpc^3 (Planck 2018 H0)
C.GeVcm3_per_Msunpc3=C.Msun_kg*C.c_ms**2/1.602176634e-10/Math.pow(C.kpc_m/1e3*100,3);
// ---- published model + frame (see galaxy.json provenance) ----
const MODEL={name:'gala MilkyWayPotential v1 (Price-Whelan 2017; disk from Bovy 2015) plus the Sgr A* point mass (GRAVITY 2022)',
 bh:{m:4.297e6},nucleus:{m:1.71e9,c:0.07},bulge:{m:5e9,c:1.0},disk:{m:6.8e10,a:3.0,b:0.28},halo:{m:5.4e11,rs:15.62}};
const FRAME={R0_kpc:8.277,sgrA:[266.41683708,-29.00781056],vsun:[11.1,251.5,7.25],
 note:'Origin at Sgr A*; axes parallel to IAU Galactic axes (x from the Sun toward the center, y along rotation, z to the north Galactic pole). R0 from GRAVITY 2022; the Sun moves at 30.39 km/s/kpc x R0 (Reid & Brunthaler 2020) with U, W from Schoenrich et al. 2010. The Sun\'s 20.8 pc height above the midplane is not applied.'};
const PATTERN={arms:4,pitch_deg:13.1,omega_p:28.2,anchor_kpc:7.0,
 note:'Schematic four-arm log spiral: pitch 13.1 deg (Vallee 2017), pattern speed 28.2 km/s/kpc (Dias et al. 2019), anchored so the Sagittarius-Carina arm crosses the Sun-center line 7.0 kpc from the center. The arm count and pattern speed of the real Milky Way are still debated.'};
const COSMO={omc_h2:0.1200,omb_h2:0.02237,src:'Planck 2018 (Aghanim et al. 2020), recalled'};COSMO.ratio=COSMO.omc_h2/COSMO.omb_h2;
const BARYON_MASS=MODEL.bh.m+MODEL.nucleus.m+MODEL.bulge.m+MODEL.disk.m;
// Hidden universe H (shares gravity, not light). 'simple': collisionless, takes the place of the NFW halo. 'mirror': a copy of our physics, its matter cools into a disk like ours, with the cosmic 5.36x our baryon mass.
const MIRROR={m:COSMO.ratio*BARYON_MASS,a:MODEL.disk.a,b:MODEL.disk.b,note:'mirror matter cools like ours, so it settles into a disk with our disk scale lengths and the cosmic dark-to-ordinary mass ratio'};
const COMP=['bh','nucleus','bulge','disk','halo'];
const LABEL={bh:'Sgr A* (black hole)',nucleus:'nuclear star cluster',bulge:'bulge',disk:'stellar disk',halo:'dark matter halo'};
const K={mi:C.GM*MIRROR.m,bh:C.GM*MODEL.bh.m,n:C.GM*MODEL.nucleus.m,b:C.GM*MODEL.bulge.m,d:C.GM*MODEL.disk.m,h:C.GM*MODEL.halo.m};
const nfwF=q=>q<1e-3?q*q/2-2*q*q*q/3:Math.log(1+q)-q/(1+q);
// ---- coordinates: ICRS -> Galactic (Hipparcos/ICRS matrix) -> galactocentric ----
const AG=[[-0.0548755604162154,-0.8734370902348850,-0.4838350155487132],[0.4941094278755837,-0.4448296299600112,0.7469822444972189],[-0.8676661490190047,-0.1980763734312015,0.4559837761750669]];
const rot=v=>AG.map(r=>r[0]*v[0]+r[1]*v[1]+r[2]*v[2]);
function unitICRS(ra,dec){const a=ra*D2R,d=dec*D2R;return[Math.cos(d)*Math.cos(a),Math.cos(d)*Math.sin(a),Math.sin(d)]}
function galHelio(ra,dec,dkpc){return rot(unitICRS(ra,dec)).map(c=>c*dkpc)}
const SGR=galHelio(FRAME.sgrA[0],FRAME.sgrA[1],FRAME.R0_kpc),SUN=SGR.map(c=>-c);
function toGalcen(ra,dec,dkpc){const g=galHelio(ra,dec,dkpc);return[g[0]-SGR[0],g[1]-SGR[1],g[2]-SGR[2]]}
function velGalcen(ra,dec,dkpc,pmra,pmdec,rv){const a=ra*D2R,d=dec*D2R,ca=Math.cos(a),sa=Math.sin(a),cd=Math.cos(d),sd=Math.sin(d),
 vr=C.pm_k*pmra*dkpc,vd=C.pm_k*pmdec*dkpc,g=rot([rv*cd*ca-vr*sa-vd*sd*ca,rv*cd*sa+vr*ca-vd*sd*sa,rv*sd+vd*cd]);
 return[g[0]+FRAME.vsun[0],g[1]+FRAME.vsun[1],g[2]+FRAME.vsun[2]]}
function hmsToDeg(s){const m=/^\s*([+\-−]?)\s*(\d+)\D+(\d+)\D+([\d.]+)/.exec(String(s));if(!m)return NaN;const v=+m[2]+m[3]/60+m[4]/3600;return(m[1]==='-'||m[1]==='−')?-v:v}
// ---- field: circular speed parts, potential, acceleration ----
function vc2parts(R){const G=C.G,M=MODEL,d=M.disk;return{bh:G*M.bh.m/R,nucleus:G*M.nucleus.m*R/((R+M.nucleus.c)**2),bulge:G*M.bulge.m*R/((R+M.bulge.c)**2),
 disk:G*d.m*R*R/Math.pow(R*R+(d.a+d.b)**2,1.5),halo:G*M.halo.m*nfwF(R/M.halo.rs)/R}}
const mirrorVc2=R=>C.G*MIRROR.m*R*R/Math.pow(R*R+(MIRROR.a+MIRROR.b)**2,1.5);
function dark2(R,dm){return dm===false?0:dm==='mirror'?mirrorVc2(R):vc2parts(R).halo}
function vcirc(R,dm){const p=vc2parts(R);return Math.sqrt(p.bh+p.nucleus+p.bulge+p.disk+dark2(R,dm))}
function phi(x,y,z,dm){const R2=x*x+y*y,r=Math.sqrt(R2+z*z)||1e-12,M=MODEL,G=C.G;let p=-G*M.bh.m/r-G*M.nucleus.m/(r+M.nucleus.c)-G*M.bulge.m/(r+M.bulge.c);
 if(dm==='mirror'){const zm=Math.sqrt(z*z+MIRROR.b**2);p-=G*MIRROR.m/Math.sqrt(R2+(MIRROR.a+zm)**2)}else if(dm!==false)p-=G*M.halo.m*Math.log(1+r/M.halo.rs)/r;const zt=Math.sqrt(z*z+M.disk.b**2);return p-G*M.disk.m/Math.sqrt(R2+(M.disk.a+zt)**2)}
function accel(x,y,z,dm,o){const R2=x*x+y*y,r2=R2+z*z,r=Math.sqrt(r2)||1e-12,M=MODEL;
 let s=K.bh/(r2*r)+K.n/(r*(r+M.nucleus.c)*(r+M.nucleus.c))+K.b/(r*(r+M.bulge.c)*(r+M.bulge.c));
 if(dm!==false&&dm!=='mirror')s+=K.h*nfwF(r/M.halo.rs)/(r2*r);
 const zt=Math.sqrt(z*z+M.disk.b*M.disk.b),az=M.disk.a+zt,D2=R2+az*az,kd=K.d/(D2*Math.sqrt(D2));
 let km=0,mz=0;if(dm==='mirror'){const zm=Math.sqrt(z*z+MIRROR.b*MIRROR.b),am=MIRROR.a+zm,Dm=R2+am*am;km=K.mi/(Dm*Math.sqrt(Dm));mz=km*z*am/zm}
 o[0]=-(s+kd+km)*x;o[1]=-(s+kd+km)*y;o[2]=-s*z-kd*z*az/zt-mz;return o}
// share of the pull from each component at a 3D point (projected on the total pull; sums to 1)
function shares(x,y,z,dm){const R2=x*x+y*y,r2=R2+z*z,r=Math.sqrt(r2)||1e-12,M=MODEL,sph={bh:K.bh/(r2*r),nucleus:K.n/(r*(r+M.nucleus.c)**2),bulge:K.b/(r*(r+M.bulge.c)**2),halo:dm==='mirror'?0:K.h*nfwF(r/M.halo.rs)/(r2*r)},
 zt=Math.sqrt(z*z+M.disk.b**2),az=M.disk.a+zt,D2=R2+az*az,kd=K.d/(D2*Math.sqrt(D2)),v={};
 Object.keys(sph).forEach(k=>v[k]=[sph[k]*x,sph[k]*y,sph[k]*z]);v.disk=[kd*x,kd*y,kd*z*az/zt];if(dm==='mirror'){const zm=Math.sqrt(z*z+MIRROR.b**2),am=MIRROR.a+zm,Dm=R2+am*am,km=K.mi/(Dm*Math.sqrt(Dm));v.halo=[km*x,km*y,km*z*am/zm]}
 const t=[0,0,0];COMP.forEach(k=>{t[0]+=v[k][0];t[1]+=v[k][1];t[2]+=v[k][2]});const n=t[0]*t[0]+t[1]*t[1]+t[2]*t[2]||1e-300,o={};
 COMP.forEach(k=>o[k]=(v[k][0]*t[0]+v[k][1]*t[1]+v[k][2]*t[2])/n);return o}
function mnRho(m,a,b,R,z){const zb=Math.sqrt(z*z+b*b);return b*b*m/(4*Math.PI)*(a*R*R+(a+3*zb)*(a+zb)**2)/(Math.pow(R*R+(a+zb)**2,2.5)*zb**3)}
function darkRho(R,z,dm){if(dm==='mirror')return mnRho(MIRROR.m,MIRROR.a,MIRROR.b,R,z);const r=Math.hypot(R,z),q=r/MODEL.halo.rs;return MODEL.halo.m/(4*Math.PI*MODEL.halo.rs**3)/(q*(1+q)**2)} // Msun/kpc^3
// ---- the hidden-universe hypothesis: same observations as the standard halo, judged by the same bands
function hiddenEvals(GAL,model){const dm=model==='mirror'?'mirror':true,R=[],add=(name,pass,detail,construction)=>R.push({name:(model==='mirror'?'Mirror H: ':'Simple H: ')+name,pass:!!pass,detail:detail+(construction?' (set by construction, not a test)':'')}),R0=FRAME.R0_kpc,S=SUN;
 add('Hidden-to-ordinary mass ratio matches the cosmic 5.36 (Planck 2018)',true,'H carries '+COSMO.ratio.toFixed(2)+' times the ordinary matter',true);
 const vc=vcirc(R0,dm);add('Circular speed at the Sun inside 222 to 240 km/s',vc>222&&vc<240,vc.toFixed(0)+' km/s');
 const fl=vcirc(20,dm)/vc;add('Rotation curve stays roughly flat out to 20 kpc (ratio 0.85 to 1.05)',fl>0.85&&fl<1.05,'v(20 kpc)/v(Sun) = '+fl.toFixed(2));
 const rho=darkRho(R0,0,dm)/1e9*C.GeVcm3_per_Msunpc3;add('Dark density at the Sun inside 0.3 to 0.5 GeV/cm3',rho>0.3&&rho<0.5,rho.toFixed(rho<10?3:0)+' GeV/cm3');
 const ve=vesc(S[0],S[1],S[2],dm);add('Escape speed at the Sun inside 480 to 620 km/s',ve>480&&ve<620,ve.toFixed(0)+' km/s');
 if(GAL&&GAL.sat){const l=GAL.sat.find(s=>s[0]==='LMC');if(l)add('The LMC stays bound',energy(l.slice(1,4),l.slice(4,7),dm)<0,'escape speed there '+vesc(l[1],l[2],l[3],dm).toFixed(0)+' km/s vs its '+Math.hypot(l[4],l[5],l[6]).toFixed(0)+' km/s')}
 const q=model==='mirror'?(()=>{let lo=1e-4,hi=50;const t=darkRho(R0,0,dm);for(let k=0;k<80;k++){const m=Math.sqrt(lo*hi);darkRho(0.01,m,dm)>t?lo=m:hi=m}return Math.sqrt(lo*hi)/R0})():1;
 add('Dark matter forms a round halo, not a thin disk (axis ratio above 0.6)',q>0.6,'axis ratio of the dark density '+q.toFixed(q<0.1?3:2));
 const sig=model==='mirror'?Math.PI*0.529177e-8**2/1.6735575e-24:0;add('Passes through itself in cluster collisions (Bullet Cluster: under 1.25 cm2/g, Randall et al. 2008)',sig<1.25,model==='mirror'?'mirror hydrogen: about '+sig.toExponential(1)+' cm2/g':'0 cm2/g (collisionless)');
 return R}
function governorAt(R){const p=vc2parts(R);let b='bh';COMP.forEach(k=>{if(p[k]>p[b])b=k});return b}
function handoffs(){const out=[];let prev=governorAt(1e-6);for(let i=1;i<=4000;i++){const R=1e-6*Math.pow(3e8,i/4000),g=governorAt(R);
  if(g!==prev){let lo=1e-6*Math.pow(3e8,(i-1)/4000),hi=R;for(let k=0;k<60;k++){const m=Math.sqrt(lo*hi);governorAt(m)===prev?lo=m:hi=m}out.push({from:prev,to:g,r_kpc:Math.sqrt(lo*hi)});prev=g}}return out}
function darkHalfRadius(){let lo=1,hi=100;for(let k=0;k<60;k++){const m=(lo+hi)/2,p=vc2parts(m);p.halo>p.bh+p.nucleus+p.bulge+p.disk?hi=m:lo=m}return(lo+hi)/2}
function influenceRadius(){const M=MODEL,f=r=>M.nucleus.m*r*r/((r+M.nucleus.c)**2)+M.bulge.m*r*r/((r+M.bulge.c)**2)-M.bh.m;let lo=1e-6,hi=1;for(let k=0;k<80;k++){const m=Math.sqrt(lo*hi);f(m)>0?hi=m:lo=m}return Math.sqrt(lo*hi)}
function vesc(x,y,z,dm){return Math.sqrt(Math.max(0,-2*phi(x,y,z,dm)))}
function energy(p,vkms,dm){return 0.5*(vkms[0]**2+vkms[1]**2+vkms[2]**2)+phi(p[0],p[1],p[2],dm)}
function jacobi(mMsun,R){const h=R*1e-3,F=r=>vcirc(r)**2/r,dF=(F(R+h)-F(R-h))/(2*h);return Math.cbrt(C.G*mMsun/(vcirc(R)**2/(R*R)-dF))}
function menc(R,dm){return vcirc(R,dm)**2*R/C.G}
function halo200(){const M=MODEL,bar=M.bh.m+M.nucleus.m+M.bulge.m+M.disk.m,f=r=>M.halo.m*nfwF(r/M.halo.rs)+bar-200*C.rho_crit*4/3*Math.PI*r*r*r;let lo=50,hi=600;for(let k=0;k<80;k++){const m=(lo+hi)/2;f(m)>0?lo=m:hi=m}
 const r=(lo+hi)/2,dark=M.halo.m*nfwF(r/M.halo.rs);return{r200_kpc:r,dark_msun:dark,visible_msun:bar,total_msun:dark+bar}}
// ---- time-reversible orbit integration (drift-kick-drift leapfrog) ----
function stepAll(X,V,n,h,dm,mask){const o=[0,0,0],hh=h/2;for(let i=0;i<n;i++){if(mask&&!mask[i])continue;const k=3*i,x=X[k]+V[k]*hh,y=X[k+1]+V[k+1]*hh,z=X[k+2]+V[k+2]*hh;accel(x,y,z,dm,o);
  const vx=V[k]+o[0]*h,vy=V[k+1]+o[1]*h,vz=V[k+2]+o[2]*h;V[k]=vx;V[k+1]=vy;V[k+2]=vz;X[k]=x+vx*hh;X[k+1]=y+vy*hh;X[k+2]=z+vz*hh}}
function advance(X,V,n,dtMyr,hmax,dm,mask){if(!dtMyr)return 0;const ns=Math.max(1,Math.ceil(Math.abs(dtMyr)/hmax)),h=dtMyr/ns;for(let s=0;s<ns;s++)stepAll(X,V,n,h,dm,mask);return ns}
function orbitSummary(p,vkms,Tmyr,h,dm){const X=Float64Array.from(p),V=Float64Array.from(vkms.map(v=>v*C.kms_kpcMyr)),n=Math.ceil(Tmyr/h);let lo=Infinity,hi=0;for(let s=0;s<n;s++){stepAll(X,V,1,h,dm);const r=Math.hypot(X[0],X[1],X[2]);if(r<lo)lo=r;if(r>hi)hi=r}return{peri_kpc:lo,apo_kpc:hi}}
// ---- S-stars: Kepler orbits around Sgr A* from sky-plane elements ----
const SKY=(function(){const a=FRAME.sgrA[0]*D2R,d=FRAME.sgrA[1]*D2R;return{N:rot([-Math.sin(d)*Math.cos(a),-Math.sin(d)*Math.sin(a),Math.cos(d)]),E:rot([-Math.sin(a),Math.cos(a),0]),L:rot([Math.cos(d)*Math.cos(a),Math.cos(d)*Math.sin(a),Math.sin(d)])}})();
function kepE(M,e){M=M%(2*Math.PI);if(M>Math.PI)M-=2*Math.PI;if(M<-Math.PI)M+=2*Math.PI;let lo=M-e,hi=M+e,E=M+e*Math.sin(M);for(let k=0;k<80;k++){const f=E-e*Math.sin(E)-M;if(Math.abs(f)<1e-13)break;f>0?hi=E:lo=E;let n=E-f/(1-e*Math.cos(E));if(!(n>lo&&n<hi))n=(lo+hi)/2;E=n}return E}
// el = [id,id2,a_arcsec,e,i,Omega,omega,Tp_year,P_year,...]; returns offset from Sgr A* (kpc, galactic axes), distance (AU), speed (km/s)
function sstar(el,year){const aAU=el[2]*FRAME.R0_kpc*1e3,e=el[3],inc=el[4]*D2R,Om=el[5]*D2R,w=el[6]*D2R,E=kepE(2*Math.PI*(year-el[7])/el[8],e),r=aAU*(1-e*Math.cos(E)),
 nu=2*Math.atan2(Math.sqrt(1+e)*Math.sin(E/2),Math.sqrt(1-e)*Math.cos(E/2)),u=w+nu,xn=r*(Math.cos(u)*Math.cos(Om)-Math.sin(u)*Math.sin(Om)*Math.cos(inc)),ye=r*(Math.cos(u)*Math.sin(Om)+Math.sin(u)*Math.cos(Om)*Math.cos(inc)),zl=r*Math.sin(u)*Math.sin(inc),
 k=1/C.kpc_au,gm=4*Math.PI*Math.PI*aAU**3/(el[8]*el[8]),v=Math.sqrt(gm*(2/r-1/aAU))*C.pm_k;
 return{p:[0,1,2].map(i=>(xn*SKY.N[i]+ye*SKY.E[i]+zl*SKY.L[i])*k),r_au:r,v_kms:v,a_au:aAU,peri_au:aAU*(1-e),mass_kepler:aAU**3/(el[8]*el[8])}}
// ---- gravitational waves from binaries (Peters 1964) ----
function peters(m1,m2,PbDays,e){const G=C.G_si,c=C.c_ms,M1=m1*C.Msun_kg,M2=m2*C.Msun_kg,M=M1+M2,Pb=PbDays*86400,a=Math.cbrt(G*M*Pb*Pb/(4*Math.PI*Math.PI)),
 fe=(1+73/24*e*e+37/96*e**4)/Math.pow(1-e*e,3.5),pbdot=-192*Math.PI/5*Math.pow(G/(c*c*c),5/3)*M1*M2/Math.cbrt(M)*Math.pow(2*Math.PI/Pb,5/3)*fe,
 L=32/5*G**4*M1*M1*M2*M2*M/(c**5*a**5)*fe,Tc=5*c**5*a**4/(256*G**3*M1*M2*M);let T=Tc;
 if(e>1e-6){const g=x=>Math.pow(x,12/19)/(1-x*x)*Math.pow(1+121/304*x*x,870/2299),h=x=>x<=0?0:Math.pow(g(x),4)*Math.pow(1-x*x,2.5)/(x*(1+121/304*x*x)),N=2000;let s=0;for(let i=0;i<=N;i++){const x=e*i/N;s+=h(x)*(i===0||i===N?1:i%2?4:2)}T=Tc*48/19/Math.pow(g(e),4)*s*e/N/3}
 return{a_m:a,pbdot,L_W:L,merge_yr:T/C.yr_s,f_gw_hz:2/Pb}}
// ---- calendar: proleptic Gregorian, year 0 = 0 CE, negative years = BCE (Human0 scale) ----
function civil(jd){const t=jd-2440587.5,z0=Math.floor(t),f=t-z0,z=z0+719468,era=Math.floor(z/146097),doe=z-era*146097,yoe=Math.floor((doe-Math.floor(doe/1460)+Math.floor(doe/36524)-Math.floor(doe/146096))/365),
 doy=doe-(365*yoe+Math.floor(yoe/4)-Math.floor(yoe/100)),mp=Math.floor((5*doy+2)/153),d=doy-Math.floor((153*mp+2)/5)+1,m=mp<10?mp+3:mp-9,y=yoe+era*400+(m<=2?1:0),s=Math.min(86399,Math.floor(f*86400+1e-6));
 return{y,m,d,hh:Math.floor(s/3600),mi:Math.floor(s%3600/60),ss:s%60}}
function jdOf(y,m,d){y-=m<=2?1:0;const era=Math.floor(y/400),yoe=y-era*400,doy=Math.floor((153*(m+(m>2?-3:9))+2)/5)+d-1;return era*146097+yoe*365+Math.floor(yoe/4)-Math.floor(yoe/100)+doy-719468+2440587.5}
function yearFrac(jd){const y=civil(jd).y,a=jdOf(y,1,1);return y+(jd-a)/(jdOf(y+1,1,1)-a)}
function jdOfYear(yf){const y=Math.floor(yf),a=jdOf(y,1,1);return a+(yf-y)*(jdOf(y+1,1,1)-a)}
const p2=n=>String(n).padStart(2,'0');
// Year counts: 'astro' (Human0 scale, year 0 = 0 CE) or 'hist' (historians: no year 0, so year 0 is 1 BCE)
let ERA='astro';function setEraStyle(s){ERA=s==='hist'?'hist':'astro';return ERA}function eraStyle(){return ERA}
function eraYear(y,style){y=Math.floor(y);const hist=(style||ERA)==='hist',n=hist&&y<=0?1-y:Math.abs(y),s=n>=10000?n.toLocaleString('en-US'):String(n);return(hist?y<=0:y<0)?s+' BCE':s+' CE'}
function fmtAgo(dy){const a=Math.abs(dy);return a>=1e9?(a/1e9).toFixed(3)+' Gyr':a>=1e6?(a/1e6).toFixed(2)+' Myr':a>=1e4?(a/1e3).toFixed(1)+' kyr':Math.round(a).toLocaleString('en-US')+' yr'}
function fmtDate(jd){const c=civil(jd);if(c.y>=1000&&c.y<=9999)return c.y+'-'+p2(c.m)+'-'+p2(c.d)+' '+p2(c.hh)+':'+p2(c.mi)+':'+p2(c.ss)+' UTC';
 return eraYear(c.y)+' '+p2(c.m)+'-'+p2(c.d)+(Math.abs(c.y)<1e5?' '+p2(c.hh)+':'+p2(c.mi)+' UTC':'')}
function fmtEpoch(y){return Math.abs(y)<10000&&y>=1000?String(Math.floor(y)):eraYear(y)}
// ---- signals: everything travels at c; 1 kly of radius per 1,000 years ----
const shellKly=(tYear,eventYear)=>Math.max(0,(tYear-eventYear)/1000);
const lightYears=dKpc=>dKpc*C.kpc_kly*1e3;
// ---- evals (run by the app's "Run physics evals" and the server's run_evals) ----
function galaxyEvals(GAL){const R=[],add=(name,pass,detail)=>R.push({name,pass:!!pass,detail}),R0=FRAME.R0_kpc,S=SUN;
 const vc=vcirc(R0),vb=vcirc(R0,false),ps=vc2parts(R0);
 add('Circular speed at the Sun is inside the measured range (229 to 236 km/s; Eilers 2019, Reid 2019)',vc>222&&vc<240,vc.toFixed(1)+' km/s; visible matter alone gives '+vb.toFixed(1)+' km/s');
 const rho=MODEL.halo.m/(4*Math.PI*MODEL.halo.rs**3)/((R0/MODEL.halo.rs)*(1+R0/MODEL.halo.rs)**2)/1e9,gev=rho*C.GeVcm3_per_Msunpc3;
 add('Dark matter density near the Sun is inside the measured range (0.3 to 0.5 GeV/cm3)',gev>0.3&&gev<0.5,rho.toFixed(4)+' Msun/pc3 = '+gev.toFixed(3)+' GeV/cm3');
 const ve=vesc(S[0],S[1],S[2]);add('Escape speed at the Sun is inside the measured range (about 500 to 600 km/s; Deason 2019, Monari 2018)',ve>480&&ve<620,ve.toFixed(0)+' km/s; without dark matter '+vesc(S[0],S[1],S[2],false).toFixed(0)+' km/s');
 const m50=menc(50);add('Mass inside 50 kpc is inside the measured range (about 4 to 6 x 10^11 Msun)',m50>3.5e11&&m50<6.5e11,m50.toExponential(2)+' Msun');
 const h=halo200();add('Total mass (M200) is inside the measured range (about 0.8 to 1.5 x 10^12 Msun)',h.total_msun>7e11&&h.total_msun<1.6e12,h.total_msun.toExponential(3)+' Msun inside '+h.r200_kpc.toFixed(0)+' kpc; '+(100*h.dark_msun/h.total_msun).toFixed(1)+'% dark');
 const rg=C.GMsun_si*MODEL.bh.m/C.c_ms**2,th=rg/(R0*C.kpc_m)/D2R*3600e6;add('Sgr A* gravitational radius subtends 5.12 micro-arcseconds (GRAVITY 2022 value)',Math.abs(th-5.12)/5.12<0.005,th.toFixed(3)+' uas; shadow diameter 2*sqrt(27)*Rg = '+(th*2*Math.sqrt(27)).toFixed(1)+' uas (EHT ring: 51.8 +/- 2.3)');
 const ri=influenceRadius()*1e3;add('Sgr A* governs only its sphere of influence (a few parsecs)',ri>1.5&&ri<6,ri.toFixed(2)+' pc: inside it the black hole outweighs the stars; its mass is '+(100*MODEL.bh.m/h.total_msun).toExponential(1)+'% of the galaxy');
 const s2=(GAL.ss||[]).find(s=>s[0]==='S2');if(s2){const o=sstar(s2,s2[7]),Pk=Math.sqrt(o.a_au**3/MODEL.bh.m);add('S2 period from Kepler\'s third law with the GRAVITY mass matches the observed 16.05 yr',Math.abs(Pk-s2[8])/s2[8]<0.02,Pk.toFixed(2)+' yr computed vs '+s2[8]+' observed');
  add('S2 pericenter speed is about 2.6% of light speed (7,650 km/s observed)',Math.abs(o.v_kms-7650)/7650<0.03,o.v_kms.toFixed(0)+' km/s at '+o.r_au.toFixed(0)+' AU')}
 if(GAL.ss){const bad=GAL.ss.filter(s=>Math.abs(sstar(s,s[7]).mass_kepler/MODEL.bh.m-1)>0.15);add('Every S-star orbit weighs the same black hole (a^3/P^2 within 15% of 4.297 million Msun)',bad.length===0,GAL.ss.length+' orbits checked'+(bad.length?'; off: '+bad.map(s=>s[0]).join(', '):''))}
 {const X=new Float64Array(S),V=new Float64Array(FRAME.vsun.map(v=>v*C.kms_kpcMyr)),E0=energy(S,FRAME.vsun),L0=S[0]*FRAME.vsun[1]-S[1]*FRAME.vsun[0];advance(X,V,1,1000,0.05,true);
  const v1=[V[0],V[1],V[2]].map(v=>v/C.kms_kpcMyr),E1=energy([X[0],X[1],X[2]],v1),L1=X[0]*v1[1]-X[1]*v1[0];add('Energy is conserved along the Sun\'s orbit for 1 billion years',Math.abs(E1-E0)/Math.abs(E0)<1e-6,Math.abs((E1-E0)/E0).toExponential(1)+' relative drift');
  add('Angular momentum about the galaxy\'s axis is conserved for 1 billion years',Math.abs(L1-L0)/Math.abs(L0)<1e-9,Math.abs((L1-L0)/L0).toExponential(1)+' relative drift');
  advance(X,V,1,-1000,0.05,true);const back=Math.hypot(X[0]-S[0],X[1]-S[1],X[2]-S[2]);add('Reverse time retraces forward time (1 billion years out and back)',back<1e-6,(back*C.kpc_au).toFixed(1)+' AU from the start after '+(1000/(2*Math.PI*R0/(vc*C.kms_kpcMyr))).toFixed(1)+' galactic orbits each way')}
 if(GAL.sat){const lmc=GAL.sat.find(s=>s[0]==='LMC');if(lmc){const d=Math.hypot(lmc[1],lmc[2],lmc[3]),v=Math.hypot(lmc[4],lmc[5],lmc[6]);add('LMC galactocentric speed matches the published 321 +/- 24 km/s (Kallivayalil 2013)',v>290&&v<350,v.toFixed(0)+' km/s at '+d.toFixed(1)+' kpc');
   add('Dark matter signal: the LMC is bound only with the dark halo',energy(lmc.slice(1,4),lmc.slice(4,7))<0&&energy(lmc.slice(1,4),lmc.slice(4,7),false)>0,'escape speed there: '+vesc(lmc[1],lmc[2],lmc[3]).toFixed(0)+' km/s with the halo, '+vesc(lmc[1],lmc[2],lmc[3],false).toFixed(0)+' km/s without')}}
 if(GAL.gc&&GAL.sat){const all=GAL.gc.concat(GAL.sat),b1=all.filter(o=>energy(o.slice(1,4),o.slice(4,7))<0).length,b0=all.filter(o=>energy(o.slice(1,4),o.slice(4,7),false)<0).length;
  add('Dark matter signal in the catalogs: fewer clusters and satellites stay bound without the halo',b0<b1,b1+' of '+all.length+' bound with the halo, '+b0+' without')}
 const hs=handoffs();add('The pull changes hands black hole -> stars -> disk -> dark halo with distance',hs.length>=3&&hs[0].from==='bh'&&hs[hs.length-1].to==='halo',hs.map(x=>LABEL[x.from]+' -> '+LABEL[x.to]+' at '+(x.r_kpc<0.1?(x.r_kpc*1e3).toFixed(2)+' pc':x.r_kpc.toFixed(2)+' kpc')).join('; '));
 add('Dark matter does not dominate at the Sun (it supplies under half of the pull)',ps.halo/(vc*vc)<0.5,(100*ps.halo/(vc*vc)).toFixed(1)+'% of the pull at the Sun; over half only beyond '+darkHalfRadius().toFixed(1)+' kpc');
 const wind=(vcirc(4)/4-vcirc(12)/12)*C.kms_kpcMyr*1e3/(2*Math.PI);add('Winding problem: material arms would wrap up, so arms must be patterns',wind>3,'an arm tied to its stars between 4 and 12 kpc would wind '+wind.toFixed(1)+' turns per billion years');
 {let lo=4,hi=14;for(let k=0;k<60;k++){const m=(lo+hi)/2;vcirc(m)/m>PATTERN.omega_p?lo=m:hi=m}const rc=(lo+hi)/2;add('Spiral pattern corotation lies near the Sun (8.51 +/- 0.64 kpc; Dias 2019)',rc>7.5&&rc<9.5,rc.toFixed(2)+' kpc')}
 const rj=jacobi(1,R0)*1e3;add('The solar system ends where the galaxy\'s tide wins: Jacobi radius of 1 Msun at the Sun is 1 to 2 pc',rj>1&&rj<2,rj.toFixed(2)+' pc = '+Math.round(rj*206264.806).toLocaleString('en-US')+' AU (outer Oort Cloud scale)');
 if(GAL.dns){GAL.dns.forEach(b=>{const p=peters(b.m1,b.m2,b.pb_d,b.e);add(b.name+': orbital decay from the quadrupole formula matches the published GR value',Math.abs(p.pbdot/b.pbdot_gr-1)<0.005,p.pbdot.toExponential(5)+' vs '+b.pbdot_gr.toExponential(5)+' s/s; merges in '+(p.merge_yr/1e6).toFixed(0)+' Myr; radiates '+p.L_W.toExponential(2)+' W')})}
 if(GAL.gwc&&GAL.gwc.length){const ok=GAL.gwc.filter(g=>g[7]!=null),bad=ok.filter(g=>!(g[7]>0&&g[7]<0.2*(g[3]+g[4]))),i=GAL.gwc.findIndex(g=>g[0]==='GW150914'),j=GAL.gwc[i];add('Gravitational-wave catalog: every stored radiated energy is a positive share under 20% of the merging mass',bad.length===0,ok.length+' of '+GAL.gwc.length+' events have a radiated energy'+(bad.length?'; off: '+bad.map(g=>g[0]).join(', '):''));
  if(j){const tj=civil(j[1]);add('GW150914 time from the catalog lands on 2015-09-14 09:50:45 UTC',tj.y===2015&&tj.m===9&&tj.d===14&&tj.hh===9&&tj.mi===50&&Math.abs(tj.ss-45)<=1,fmtDate(j[1])+'; radiated '+j[7]+' Msun c^2')}}
 {const dv=1.74/(40e3*C.kpc_m/C.c_ms);add('GW170817: gravitational waves and light crossed 130 million light years within 1.74 s',dv<1e-14,'speed difference under '+dv.toExponential(1)+' of c')}
 {const a=eraYear(0,'astro'),h=eraYear(0,'hist'),h2=eraYear(-2491,'hist');add('Calendar: historians\' count has no year 0 (0 CE on the year-0 scale is 1 BCE)',a==='0 CE'&&h==='1 BCE'&&h2==='2492 BCE'&&eraYear(1,'hist')==='1 CE',a+' = '+h+'; 2491 BCE = '+h2+' (historians)')}
 add('Unit handoff SCW4 <-> SCW5 (kpc <-> thousand light years)',Math.abs(C.kpc_kly-3.2615637769)<1e-8,C.kpc_kly.toFixed(10)+' kly per kpc');
 {const j=jdOf(-2491,7,22)+21/24+22.5/1440;add('Calendar: BCE dates keep the 12-month year and count backward through December 31',fmtDate(j)==='2491 BCE 07-22 21:22 UTC'&&civil(jdOf(0,1,1)-1).y===-1&&civil(jdOf(0,1,1)-1).m===12&&civil(jdOf(0,1,1)-1).d===31&&Math.abs(jdOf(2000,1,1)-2451544.5)<1e-9,fmtDate(j)+'; the day before 0 CE 01-01 is '+fmtDate(jdOf(0,1,1)-1).slice(0,11))}
 return R}
// ---- energy + matter ledger (SI). Every SCW system reduces to matter (kg), rest energy (mc^2), motion and binding energy, and radiated signals. ----
function ledger(GAL){const c2=C.c_ms**2,Ms=C.Msun_kg,rows=[],row=(scale,system,o)=>rows.push(Object.assign({scale,system},o)),R0=FRAME.R0_kpc,h=halo200(),J=1e6; // (km/s)^2 -> J/kg
 const vE=29.7827e3,eE=C.Mearth_kg;row('Solar System (SCW6)','Sun',{matter_kg:Ms,rest_J:Ms*c2,power_W:C.Lsun_W,note:'radiates 4.26 million tonnes of mass as light every second'});
 row('Solar System (SCW6)','Earth',{matter_kg:eE,rest_J:eE*c2,kinetic_J:0.5*eE*vE*vE,binding_J:-0.5*eE*vE*vE,note:'orbital energy around the Sun (bound: negative)'});
 row('Solar System (SCW6)','Jupiter',{matter_kg:C.Mjup_kg,rest_J:C.Mjup_kg*c2,kinetic_J:0.5*C.Mjup_kg*13.07e3**2,binding_J:-0.5*C.Mjup_kg*13.07e3**2});
 const vs=Math.hypot(...FRAME.vsun),es=energy(SUN,FRAME.vsun),esb=energy(SUN,FRAME.vsun,false);
 row('Galaxy (SCW4)','Sun on its galactic orbit',{matter_kg:Ms,rest_J:Ms*c2,kinetic_J:0.5*Ms*(vs*1e3)**2,binding_J:es*J*Ms,note:'without dark matter its orbital energy would be '+(esb*J*Ms).toExponential(2)+' J ('+(esb<0?'still bound':'unbound')+')'});
 COMP.forEach(k=>{const m=k==='halo'?h.dark_msun:MODEL[k].m;row('Galaxy (SCW4)','Field component: '+LABEL[k],{matter_kg:m*Ms,rest_J:m*Ms*c2,note:k==='halo'?'dark matter inside r200 = '+h.r200_kpc.toFixed(0)+' kpc; never detected directly, inferred from motion':k==='bh'?'GRAVITY 2022':'gala MilkyWayPotential v1'})});
 {let W=0,pr=1e-4,pm=menc(pr);for(let i=1;i<=3000;i++){const r=1e-4*Math.pow(h.r200_kpc/1e-4,i/3000),m=menc(r),vm=vcirc(Math.sqrt(r*pr));W-=vm*vm*(m-pm);pr=r;pm=m}
  row('Galaxy (SCW4)','Milky Way as one system',{matter_kg:h.total_msun*Ms,rest_J:h.total_msun*Ms*c2,binding_J:W*J*Ms/2,note:'binding energy (spherical estimate, virial: half the potential energy) = '+(Math.abs(W)/2*J/c2/h.total_msun).toExponential(1)+' of its rest energy'})}
 row('Signals','Supernova (canonical)',{radiated_J:1e44,note:'kinetic energy of the ejecta (10^51 erg); about 3 x 10^46 J more leaves as neutrinos in a core collapse. Typical values, not per-object measurements'});
 row('Signals','Local Bubble (SCW5)',{radiated_J:15e44,note:'about 15 supernovae over 14.4 Myr blew the cavity (Zucker et al. 2022), at the canonical 10^44 J each'});
 if(GAL.gwc){const ok=GAL.gwc.filter(g=>g[7]!=null),m=ok.reduce((a,g)=>a+g[7],0),big=ok.reduce((a,g)=>g[7]>a[7]?g:a,ok[0]);row('Signals','Gravitational-wave catalog: '+GAL.gwc.length+' detected mergers (GWTC)',{radiated_J:m*Ms*c2,matter_kg:m*Ms,note:ok.length+' events with masses radiated '+m.toFixed(1)+' Msun c^2 in total; the largest, '+big[0]+', radiated '+big[7]+' Msun c^2. All far outside the Milky Way'})}
 (GAL.gw||[]).forEach(g=>row('Signals',g.name,{matter_kg:g.erad_msun*Ms,radiated_J:g.erad_msun*Ms*c2,power_W:g.peak_W,note:g.note}));
 (GAL.dns||[]).forEach(b=>{const p=peters(b.m1,b.m2,b.pb_d,b.e);row('Signals',b.name+' (gravitational waves now)',{matter_kg:(b.m1+b.m2)*Ms,rest_J:(b.m1+b.m2)*Ms*c2,power_W:p.L_W,note:'continuous; '+(p.L_W/C.Lsun_W*100).toFixed(1)+'% of the Sun\'s light output; merges in '+(p.merge_yr/1e6).toFixed(0)+' Myr'})});
 return rows}
const api={C,MODEL,FRAME,PATTERN,COMP,LABEL,SUN,SGR,SKY,nfwF,unitICRS,galHelio,toGalcen,velGalcen,hmsToDeg,vc2parts,vcirc,phi,accel,shares,governorAt,handoffs,darkHalfRadius,influenceRadius,vesc,energy,jacobi,menc,halo200,
 COSMO,MIRROR,BARYON_MASS,darkRho,hiddenEvals,dark2,stepAll,advance,orbitSummary,kepE,sstar,peters,civil,jdOf,yearFrac,jdOfYear,eraYear,setEraStyle,eraStyle,fmtAgo,fmtDate,fmtEpoch,shellKly,lightYears,galaxyEvals,ledger};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GXC=api;
})(typeof globalThis!=='undefined'?globalThis:this);
