const D=Math.PI/180,EPS=23.43928*D,AUKM=149597870.7;
const PL=[["Mercury",[0.38709927,0.20563593,7.00497902,252.2503235,77.45779628,48.33076593],[3.7e-7,1.906e-5,-0.00594749,149472.67411175,0.16047689,-0.12534081],0x9a9890,2439.7],
["Venus",[0.72333566,0.00677672,3.39467605,181.9790995,131.60246718,76.67984255],[3.9e-6,-4.107e-5,-0.0007889,58517.81538729,0.00268329,-0.27769418],0xe8cda0,6051.8],
["Earth",[1.00000261,0.01671123,-1.531e-5,100.46457166,102.93768193,0],[5.62e-6,-4.392e-5,-0.01294668,35999.37244981,0.32327364,0],0x3d7cc9,6371],
["Mars",[1.52371034,0.0933941,1.84969142,-4.55343205,-23.94362959,49.55953891],[1.847e-5,7.882e-5,-0.00813131,19140.30268499,0.44441088,-0.29257343],0xc1440e,3389.5],
["Jupiter",[5.202887,0.04838624,1.30439695,34.39644051,14.72847983,100.47390909],[-0.00011607,-0.00013253,-0.00183714,3034.74612775,0.21252668,0.20469106],0xd8b98c,69911],
["Saturn",[9.53667594,0.05386179,2.48599187,49.95424423,92.59887831,113.66242448],[-0.0012506,-0.00050991,0.00193609,1222.49362201,-0.41897216,-0.28867794],0xe3d2a1,58232],
["Uranus",[19.18916464,0.04725744,0.77263783,313.23810451,170.9542763,74.01692503],[-0.00196176,-4.397e-5,-0.00242939,428.48202785,0.40805281,0.04240589],0xa6d8de,25362],
["Neptune",[30.06992276,0.00859048,1.77004347,-55.12002969,44.96476227,131.78422574],[0.00026291,5.105e-5,0.00035372,218.45945325,-0.32241464,-0.01262724],0x4a6fd6,24622],
["Pluto",[39.48211675,0.2488273,17.14001206,238.92903833,224.06891629,110.30393684],[-0.00031596,5.17e-5,4.818e-5,145.20780515,-0.04062942,-0.01183482],0xcbb59a,1188.3]];
const KB=[["Eris",67.86,0.4359,44.04,35.95,151.64,205.99,2459000.5,0xdddddd,1163],["Makemake",45.43,0.161,28.98,79.62,294.8,165.5,2459000.5,0xc98b6b,715],["Haumea",43.12,0.195,28.2,122.1,239.0,218.2,2459000.5,0xeeeeee,798],["Gonggong",67.4,0.5,30.9,336.8,207.6,107,2459000.5,0xb06050,615],["Quaoar",43.7,0.04,7.99,188.9,147.5,301,2459000.5,0xa07060,555],["Orcus",39.2,0.227,20.6,268.8,72.3,181,2459000.5,0xbbbbbb,455],["Arrokoth",44.6,0.04,2.45,159,174,316,2459000.5,0xb07050,9],["Sedna",506,0.855,11.93,144.4,311.3,null,2479566,0xb5443a,500],["Halley's Comet",17.834,0.96714,162.26,58.42,111.33,null,2446470.96,0xd4537e,5.5]];
const MO={Earth:[["Moon",27.321661,384400,1737.4]],Mars:[["Phobos",0.31891,9376,11.3],["Deimos",1.26244,23463,6.2]],Jupiter:[["Io",1.769138,421700,1821.6],["Europa",3.551181,671034,1560.8],["Ganymede",7.154553,1070412,2634.1],["Callisto",16.689018,1882709,2410.3]],Saturn:[["Enceladus",1.370218,237948,252.1],["Rhea",4.518212,527108,763.8],["Titan",15.945421,1221870,2574.7],["Iapetus",79.3215,3560820,734.5]],Uranus:[["Miranda",1.413479,129390,235.8],["Titania",8.705872,435910,788.4],["Oberon",13.463239,583520,761.4]],Neptune:[["Triton",-5.876854,354759,1353.4]],Pluto:[["Charon",6.387221,19591,606]]};
const TILT={Earth:5.1,Mars:25.2,Jupiter:3.1,Saturn:26.7,Uranus:97.8,Neptune:28.3,Pluto:119.6};
function kep(M,e){M=((M+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;let lo=-Math.PI,hi=Math.PI,E=e>0.8?(M<0?-Math.PI:Math.PI)*0.9+M*0.1:M;
for(let k=0;k<80;k++){const f=E-e*Math.sin(E)-M;if(Math.abs(f)<1e-13)break;if(f>0)hi=E;else lo=E;let En=E-f/(1-e*Math.cos(E));if(!(En>lo&&En<hi))En=(lo+hi)/2;E=En}return E}
function xyz(a,e,i,O,w,E){const xv=a*(Math.cos(E)-e),yv=a*Math.sqrt(1-e*e)*Math.sin(E),cO=Math.cos(O*D),sO=Math.sin(O*D),cw=Math.cos(w*D),sw=Math.sin(w*D),ci=Math.cos(i*D),si=Math.sin(i*D);
return[(cO*cw-sO*sw*ci)*xv+(-cO*sw-sO*cw*ci)*yv,(sO*cw+cO*sw*ci)*xv+(-sO*sw+cO*cw*ci)*yv,(sw*si)*xv+(cw*si)*yv]}
function plEl(p,jd){const T=(jd-2451545)/36525,v=p[1].map((x,k)=>x+p[2][k]*T);return{a:v[0],e:v[1],i:v[2],O:v[5],w:v[4]-v[5],M:v[3]-v[4]}}
function kbEl(k){return{a:k[1],e:k[2],i:k[3],O:k[4],w:k[5]}}
function kbM(k,jd){const n=0.9856076686/Math.pow(k[1],1.5);return k[6]===null?n*(jd-k[7]):k[6]+n*(jd-k[7])}
function posEl(o,Mdeg){return xyz(o.a,o.e,o.i,o.O,o.w,kep(Mdeg*D,o.e))}
function plPos(p,jd){const o=plEl(p,jd);return posEl(o,o.M)}
function kbPos(k,jd){return posEl(kbEl(k),kbM(k,jd))}
function moonGeo(jd){const d=jd-2451545,L=(218.316+13.176396*d)*D,Mp=(134.963+13.064993*d)*D,F=(93.272+13.22935*d)*D,lon=L+6.289*D*Math.sin(Mp),lat=5.128*D*Math.sin(F),r=(385001-20905*Math.cos(Mp))/AUKM;return[r*Math.cos(lat)*Math.cos(lon),r*Math.cos(lat)*Math.sin(lon),r*Math.sin(lat)]}
function eq2ecl(ra,dec){const x=Math.cos(dec*D)*Math.cos(ra*D),y=Math.cos(dec*D)*Math.sin(ra*D),z=Math.sin(dec*D);return[x,y*Math.cos(EPS)+z*Math.sin(EPS),-y*Math.sin(EPS)+z*Math.cos(EPS)]}
const AST=[["Ceres",2.766,0.0797,10.59,80.25,73.29,274.42,469.7],["Vesta",2.361,0.0902,7.14,103.70,151.47,81.19,261.4],["Pallas",2.77,0.2307,34.93,172.89,310.97,254.25,256.5],["Hygiea",3.151,0.1067,3.83,283.12,312.42,252.03,203.6],["Interamnia",3.057,0.1551,17.32,280.17,94.06,221.14,153.2],["Europa (52)",3.094,0.1125,7.48,128.57,342.80,348.92,152.0],["Davida",3.162,0.1894,15.95,107.55,336.53,70.44,135.2],["Euphrosyne",3.162,0.2158,26.31,30.79,62.01,182.91,133.5],["Patientia",3.065,0.0695,15.21,89.00,337.23,221.20,127.0],["Sylvia",3.491,0.0942,10.85,72.95,267.10,123.92,126.5],["Juno (3)",2.671,0.2557,12.99,169.81,247.90,262.73,123.3],["Cybele",3.407,0.1279,3.57,155.10,104.23,303.90,118.6],["Thisbe",2.766,0.1656,5.23,276.32,36.97,244.36,116.0],["Eunomia",2.642,0.1878,11.76,292.88,98.46,159.69,115.8],["Psyche",2.926,0.1349,3.10,149.98,230.03,79.77,111.0],["Bamberga",2.683,0.3404,11.10,327.82,44.19,313.72,110.3],["Doris",3.114,0.0661,6.56,183.42,251.45,177.54,108.2],["Ursula",3.127,0.1022,15.94,336.38,341.34,40.50,108.0],["Camilla",3.497,0.0673,10.01,172.39,303.01,3.47,105.2],["Hermione",3.458,0.1244,7.57,72.88,296.94,258.71,104.5]];
AST.push(["Apophis",0.922,0.191,3.34,204,127,175,0.17,"nea"],["Phaethon",1.27,0.89,22.3,265,322,301,2.6,"nea"]);
AST.forEach(a=>KB.push([a[0],a[1],a[2],a[3],a[4],a[5],a[6],2461200.5,a[0]==="Vesta"?0xb9b1a3:0x8f877a,a[7],a[8]||"ast"]));
const EP=2461356.5;
const HEL=[["Europa Clipper",2.392748618e8,0.47553371,2.0465837,71.43231,302.40025,9.463402,5.6393992e-6,6065,"NASA 2024, cruise to Jupiter"],["JUICE",2.439520897e8,0.47896692,0.0043389,178.81449,244.12074,0.9654627,5.4779951e-6,6070,"ESA 2023, cruise to Jupiter"],["Lucy",5.017958457e8,0.71339389,4.4201287,261.23340,160.41727,114.47561,1.8568972e-6,1550,"NASA 2021, Trojan asteroid tour"],["Psyche (spacecraft)",3.173124829e8,0.33385429,2.6761434,158.31464,227.12954,49.613903,3.6927314e-6,2608,"NASA 2023, cruise to asteroid Psyche"],["Hera",2.457537713e8,0.38310398,3.4137671,72.984919,319.57594,333.89092,5.4178648e-6,1128,"ESA 2024, cruise to Didymos"],["Tesla Roadster",1.982569809e8,0.25595898,1.0747808,316.87245,177.78854,269.44539,7.4771435e-6,1305,"SpaceX Falcon Heavy test payload 2018"],["Solar Orbiter",8.931861349e7,0.50731219,12.617862,322.34562,306.39476,181.22594,2.4726662e-5,1800,"ESA/NASA 2020"],["Parker Solar Probe",5.810868276e7,0.88202538,3.3911024,76.481562,68.641180,278.44715,4.7121261e-5,685,"NASA 2018, closest to the Sun"],["STEREO-A",1.437280271e8,0.00674668,0.1279750,212.28640,77.905699,191.06451,1.2113405e-5,620,"NASA 2006, solar observatory"],["Kepler",1.515599790e8,0.03608756,0.4483238,154.11228,294.15507,199.62929,1.1186691e-5,1052,"NASA 2009, retired 2018, Earth-trailing"],["Spitzer",1.517173292e8,0.01128151,1.1330785,316.24408,195.74965,84.846777,1.1169293e-5,950,"NASA 2003, retired 2020, Earth-trailing"]];
const VEC=[["Voyager 1",-32.21322784,-137.15476814,99.23372155,-1.195239291e-3,-7.861206678e-3,5.678193138e-3,722,"NASA 1977, interstellar space"],["Voyager 2",39.99223406,-105.69091481,-89.97781659,2.427657926e-3,-5.394406806e-3,-6.535623588e-3,722,"NASA 1977, interstellar space"],["New Horizons",20.97590585,-62.57875541,2.302440400,3.064732222e-3,-7.210865758e-3,2.837737820e-4,478,"NASA 2006, Kuiper Belt"],["Pioneer 10",24.10082894,139.96264696,7.407048426,7.086585471e-4,6.797170539e-3,3.482484292e-4,258,"NASA 1972, silent since 2003"],["Pioneer 11",29.18494219,-111.01336572,28.28818765,2.331754791e-3,-5.830405852e-3,1.404023413e-3,259,"NASA 1973, silent since 1995"]];
const PAR={Earth:[6371,398600.44,"eq"],Moon:[1737.4,4902.8,"ecl"],Mars:[3389.5,42828.4,25.2],Jupiter:[69911,1.26687e8,3.1],Mercury:[2439.7,22032,0]};
const ORB=[["ISS","LEO","Earth",413,422,51.64,420000,"NASA/Roscosmos/ESA/JAXA/CSA, crewed"],["Tiangong","LEO","Earth",380,390,41.47,100000,"CMSA, crewed"],["Hubble","LEO","Earth",500,510,28.47,11110,"NASA/ESA 1990"],["SL-16 rocket bodies","LEO","Earth",830,850,71.0,9000,"~20 Zenit-2 upper stages, 9 t each, derelict"],["Envisat","LEO","Earth",762,768,98.2,8211,"ESA 2002, derelict since 2012"],["Terra","LEO","Earth",700,710,98.2,5190,"NASA 1999"],["ADEOS-II","LEO","Earth",800,810,98.6,3680,"JAXA 2002, derelict"],["Aura","LEO","Earth",700,710,98.2,2970,"NASA 2004"],["Aqua","LEO","Earth",700,710,98.2,2934,"NASA 2002"],["Landsat 9","LEO","Earth",700,710,98.2,2711,"NASA/USGS 2021"],["NOAA-20","LEO","Earth",820,830,98.7,2294,"NOAA/NASA 2017"],["Suomi NPP","LEO","Earth",820,830,98.7,2128,"NOAA/NASA 2011"],
["EchoStar XXIV (Jupiter 3)","Earth (GEO/MEO/HEO)","Earth",35780,35790,0.05,9200,"Hughes 2023, largest commercial GEO satellite"],["TerreStar-1","Earth (GEO/MEO/HEO)","Earth",35780,35790,0.05,6910,"2009, GEO"],["ViaSat-3 Americas","Earth (GEO/MEO/HEO)","Earth",35780,35790,0.05,6400,"ViaSat 2023, GEO"],["Chandra","Earth (GEO/MEO/HEO)","Earth",16000,133000,65,4790,"NASA 1999, highly elliptical"],["XMM-Newton","Earth (GEO/MEO/HEO)","Earth",7000,114000,70,3800,"ESA 1999, highly elliptical"],["GPS III","Earth (GEO/MEO/HEO)","Earth",20180,20200,55,3880,"US Space Force, MEO constellation"],["Galileo","Earth (GEO/MEO/HEO)","Earth",23220,23230,56,733,"EU, MEO constellation"],["TESS","Earth (GEO/MEO/HEO)","Earth",108000,375000,37,362,"NASA 2018, lunar-resonant orbit"],
["Chandrayaan-2 orbiter","Moon orbit","Moon",100,100,90,2379,"ISRO 2019, polar"],["LRO","Moon orbit","Moon",30,180,90,1916,"NASA 2009, polar"],["Queqiao-2","Moon orbit","Moon",200,16000,62,1200,"CNSA 2024, relay, elliptical frozen orbit"],["Danuri","Moon orbit","Moon",100,100,90,678,"KARI 2022, polar"],["ARTEMIS P1","Moon orbit","Moon",100,19000,20,130,"NASA, elliptical"],["ARTEMIS P2","Moon orbit","Moon",100,19000,20,130,"NASA, elliptical"],
["MRO","Mars orbit","Mars",255,320,93,2180,"NASA 2005"],["TGO","Mars orbit","Mars",400,410,74,3755,"ESA/Roscosmos 2016"],["Tianwen-1 orbiter","Mars orbit","Mars",265,12000,87,3175,"CNSA 2020"],["MAVEN","Mars orbit","Mars",150,6200,75,2454,"NASA 2013"],["Emirates Hope","Mars orbit","Mars",20000,43000,25,1350,"UAE 2020"],["Mars Express","Mars orbit","Mars",300,10100,86,1123,"ESA 2003"],["Mars Odyssey","Mars orbit","Mars",400,410,93,725,"NASA 2001"],
["Juno","Beyond Mars","Jupiter",4200,2600000,90,3625,"NASA 2011, polar Jupiter orbit"],["BepiColombo","Sun orbit","Mercury",500,2000,90,4100,"ESA/JAXA 2018, Mercury arrival late 2026 (orbit illustrative)"]];
const LAG=[["JWST","L1/L2 (Sun–Earth, Earth–Moon)","SEL2",6161,"NASA/ESA/CSA 2021"],["Spektr-RG","L1/L2 (Sun–Earth, Earth–Moon)","SEL2",2712,"Roscosmos/DLR 2019"],["Euclid","L1/L2 (Sun–Earth, Earth–Moon)","SEL2",2000,"ESA 2023"],["SOHO","L1/L2 (Sun–Earth, Earth–Moon)","SEL1",1850,"ESA/NASA 1995"],["Aditya-L1","L1/L2 (Sun–Earth, Earth–Moon)","SEL1",1475,"ISRO 2023"],["Wind","L1/L2 (Sun–Earth, Earth–Moon)","SEL1",1250,"NASA 1994"],["ACE","L1/L2 (Sun–Earth, Earth–Moon)","SEL1",785,"NASA 1997"],["DSCOVR","L1/L2 (Sun–Earth, Earth–Moon)","SEL1",570,"NOAA/NASA 2015"],["Queqiao","L1/L2 (Sun–Earth, Earth–Moon)","EML2",425,"CNSA 2018, Earth–Moon L2 relay"]];
const SURF=[["Perseverance","Mars surface","Mars",1025,"NASA 2020 rover, Jezero Crater"],["Curiosity","Mars surface","Mars",899,"NASA 2011 rover, Gale Crater"],["Zhurong","Mars surface","Mars",240,"CNSA 2021 rover, inactive"]];
function hsh(s){let h=0;for(const c of s)h=(h*31+c.charCodeAt(0))>>>0;return h/4294967296}
function helPos(h,jd){const n=h[7]*86400;return xyz(h[1]/AUKM,h[2],h[3],h[4],h[5],kep((h[6]+n*(jd-EP))*D,h[2]))}
function vecPos(v,jd){const t=jd-EP;return[v[1]+v[4]*t,v[2]+v[5]*t,v[3]+v[6]*t]}
function orbOff(o,jd){const p=PAR[o[2]],q=p[0]+o[3],Q=p[0]+o[4],a=(q+Q)/2,e=(Q-q)/(Q+q),per=2*Math.PI*Math.sqrt(a*a*a/p[1])/86400,h=hsh(o[0]),M=360*((jd-EP)/per%1+h);
let v=xyz(a,e,o[5],360*h*7%360,360*h*13%360,kep(M*D,e));if(p[2]==="eq")v=[v[0],v[1]*Math.cos(EPS)+v[2]*Math.sin(EPS),-v[1]*Math.sin(EPS)+v[2]*Math.cos(EPS)];else if(typeof p[2]==="number"){const t=p[2]*D;v=[v[0],v[1]*Math.cos(t)-v[2]*Math.sin(t),v[1]*Math.sin(t)+v[2]*Math.cos(t)]}
return{u:v.map(c=>c/Math.hypot(...v)),rkm:Math.hypot(...v),a,e,per}}
function observe(b,earth,jd,lat,lon){const g=[b[0]-earth[0],b[1]-earth[1],b[2]-earth[2]],r=Math.hypot(...g),xq=g[0],yq=g[1]*Math.cos(EPS)-g[2]*Math.sin(EPS),zq=g[1]*Math.sin(EPS)+g[2]*Math.cos(EPS);
const ra=((Math.atan2(yq,xq)/D)%360+360)%360,dec=Math.asin(zq/r)/D,lst=((280.46061837+360.98564736629*(jd-2451545)+lon)%360+360)%360,H=(lst-ra)*D,ph=lat*D,dd=dec*D;
const alt=Math.asin(Math.sin(ph)*Math.sin(dd)+Math.cos(ph)*Math.cos(dd)*Math.cos(H))/D,az=((Math.atan2(-Math.sin(H),Math.tan(dd)*Math.cos(ph)-Math.sin(ph)*Math.cos(H))/D)%360+360)%360;return{r,ra,dec,alt,az}}
const PLANNED=[["MMX","JAXA","H3-24L","Launched October 2026","Mars","En route: Mars arrival August 2027, then Phobos landing and sample return. Shown at its destination."],["PLATO","ESA","Ariane 62","End of 2026","SEL2","Exoplanet survey telescope, 26 cameras"],["Comet Interceptor","ESA (with JAXA)","Ariane 64","2028–2029","SEL2","Waits at L2 for a long-period comet or interstellar object, then intercepts it"],["ARIEL","ESA","Ariane 6","NET H2 2031","SEL2","Exoplanet atmosphere survey"],["EnVision","ESA","Ariane 6","2031–2032","Venus","Venus orbiter"],["Ramses","ESA","H3 (shared with DESTINY+)","2028","Apophis","Escorts asteroid Apophis through its April 2029 Earth flyby"],["DESTINY+","JAXA (with DLR)","H3","Spring 2028","Phaethon","Flyby of asteroid Phaethon, Geminid meteor parent"],["DAVINCI","NASA","Not yet announced","December 2030","Venus","Venus flyby and atmospheric descent probe"],["VERITAS","NASA","Not yet announced","November 2032","Venus","Venus radar mapping orbiter"]];
const GMS=2.959122082855911e-4,GMP={Earth:398600.4418,Mars:42828.37,Jupiter:126686534,Saturn:37931187,Uranus:5793939,Neptune:6836529,Pluto:975.5};
function kepH(M,e){let H=Math.asinh(M/e);for(let k=0;k<100;k++){const f=e*Math.sinh(H)-H-M,d=f/(e*Math.cosh(H)-1);H-=d;if(Math.abs(d)<1e-13)break}return H}
function hypPos(q,e,i,O,w,tp,jd,mu){const a=q/(1-e),n=Math.sqrt(mu/Math.pow(-a,3)),H=kepH(n*(jd-tp),e),xv=-a*(e-Math.cosh(H)),yv=-a*Math.sqrt(e*e-1)*Math.sinh(H),cO=Math.cos(O*D),sO=Math.sin(O*D),cw=Math.cos(w*D),sw=Math.sin(w*D),ci=Math.cos(i*D),si=Math.sin(i*D);
return[(cO*cw-sO*sw*ci)*xv+(-cO*sw-sO*cw*ci)*yv,(sO*cw+cO*sw*ci)*xv+(-sO*sw+cO*cw*ci)*yv,(sw*si)*xv+(cw*si)*yv]}
function physicsEvalsSolar(){const R=[],add=(name,pass,detail)=>R.push({name,pass:!!pass,detail});const dtd=1e-3;
const vel=(f,jd,h)=>{h=h||dtd;const a=f(jd-h),b=f(jd+h),a2=f(jd-2*h),b2=f(jd+2*h);return[0,1,2].map(i=>(8*(b[i]-a[i])-(b2[i]-a2[i]))/(12*h))};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
let worstK=0,wn='';PL.forEach(p=>{const n=p[2][3]/36525,Pn=360/n,a=p[1][0],Pk=2*Math.PI*Math.sqrt(a*a*a/GMS),r=Math.abs(Pn-Pk)/Pk;if(r>worstK){worstK=r;wn=p[0]}});add("Kepler's third law: planet periods vs semimajor axes",worstK<0.005,'worst '+wn+' '+(worstK*100).toFixed(3)+'% (limit 0.5%)');
const pure=[],fit=[];PL.forEach(p=>{const n=p[2][3]/36525*D;fit.push([p[0],j=>plPos(p,j),Math.cbrt(GMS/(n*n))])});KB.forEach(k=>pure.push([k[0],j=>kbPos(k,j),k[1]]));HEL.forEach(h=>pure.push([h[0],j=>helPos(h,j),h[1]/AUKM]));
const consv=(bodies,lim,label)=>{
let wE=0,wEn='',wH=0,wHn='';bodies.forEach(([nm,f,a])=>{const Es=[],Hs=[],h=Math.pow(a,1.5)*365.25*2e-5;for(let k=0;k<5;k++){const j=2461356+k*Math.max(1,Math.pow(a,1.5)*73),r=f(j),v=vel(f,j,h),rr=Math.hypot(...r);Es.push((v[0]*v[0]+v[1]*v[1]+v[2]*v[2])/2-GMS/rr);Hs.push(Math.hypot(...cross(r,v)))}
const E0=-GMS/(2*a),eE=Math.max(...Es.map(e=>Math.abs(e-E0)/Math.abs(E0))),eH=(Math.max(...Hs)-Math.min(...Hs))/Hs[0];if(eE>wE){wE=eE;wEn=nm}if(eH>wH){wH=eH;wHn=nm}});
add('Energy (vis-viva) conserved: '+label+' ('+bodies.length+')',wE<lim,'worst '+wEn+' '+wE.toExponential(2)+' relative (limit '+lim.toExponential(0)+')');
add('Angular momentum conserved: '+label,wH<lim,'worst '+wHn+' '+wH.toExponential(2)+' relative (limit '+lim.toExponential(0)+')')};
consv(pure,1e-6,'pure two-body orbits — comet, asteroids, KBOs, spacecraft');consv(fit,5e-3,'JPL-fitted planets (fitted motion includes real perturbations, ~0.07% off pure Kepler)');
let wr=0;[0.01,0.2,0.5,0.9,0.967].forEach(e=>{for(let k=0;k<2000;k++){const M=-Math.PI+2*Math.PI*k/2000,E=kep(M,e);wr=Math.max(wr,Math.abs(E-e*Math.sin(E)-M))}});add('Kepler equation solver residual (e up to 0.967)',wr<1e-10,'max residual '+wr.toExponential(2)+' rad');
let wm=0,wmn='';Object.keys(MO).forEach(par=>MO[par].forEach(m=>{if(!GMP[par])return;const a=m[2],P=2*Math.PI*Math.sqrt(a*a*a/GMP[par])/86400,r=Math.abs(P-Math.abs(m[1]))/Math.abs(m[1]);if(r>wm){wm=r;wmn=m[0]}}));add("Kepler's third law: moon periods vs parent mass",wm<0.03,'worst '+wmn+' '+(wm*100).toFixed(2)+'% (limit 3%)');
const eds=[];for(let k=0;k<366;k++)eds.push(Math.hypot(...plPos(PL[2],2461356+k)));const mn=Math.min(...eds),mx=Math.max(...eds);add('Earth–Sun distance range over one year',mn>0.982&&mn<0.984&&mx>1.016&&mx<1.018,mn.toFixed(4)+'–'+mx.toFixed(4)+' AU (expected 0.983–1.017)');
const iss=orbOff(ORB[0],2461356);add('ISS orbital period from Earth gravity',Math.abs(iss.per*1440-92.8)<1.5,(iss.per*1440).toFixed(2)+' min (expected ~92.8)');
const geo=orbOff(ORB[12],2461356);add('Geostationary period equals one sidereal day',Math.abs(geo.per*24-23.934)<0.01,(geo.per*24).toFixed(3)+' h (expected 23.934)');
const v1=vecPos(VEC[0],2461356);add('Voyager 1 matches JPL Horizons on 2026-11-12',Math.abs(Math.hypot(...v1)-172.3)<0.2,Math.hypot(...v1).toFixed(2)+' AU from Sun (JPL 172.3)');
const ly=299792.458*31557600/149597870.7;add('Light-year to AU conversion (c × Julian year)',Math.abs(ly-63241.077)<0.01,ly.toFixed(3)+' AU per ly');
return R}
function physicsEvalsBubble(d,years){const R=[],add=(name,pass,detail)=>R.push({name,pass:!!pass,detail});const PC=3.261563777,S=d.stars;
const pos=(s,t)=>[s[3]+s[14][0]*t,s[4]+s[14][1]*t,s[5]+s[14][2]*t];const C=d.bubble.center_pc.map(c=>c*PC),BC=d.barycenter_pc.map(c=>c*PC);
let wd=0;for(let k=0;k<300;k++){const a=S[(k*7919)%S.length],b=S[(k*104729+13)%S.length],p=pos(a,years),q=pos(b,years);const base=Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2]);[C,BC].forEach(O=>{const p2=p.map((c,i)=>c-O[i]),q2=q.map((c,i)=>c-O[i]);wd=Math.max(wd,Math.abs(Math.hypot(p2[0]-q2[0],p2[1]-q2[1],p2[2]-q2[2])-base))})}
add('Distances between stars are identical in all three centered views',wd<1e-9,'max difference '+wd.toExponential(2)+' ly over 300 pairs');
let wl=0;S.forEach(s=>{const a=pos(s,3e5),b=pos(s,1e5),c=b.map((x,i)=>x+s[14][i]*2e5);wl=Math.max(wl,Math.hypot(a[0]-c[0],a[1]-c[1],a[2]-c[2]))});add('Star motion is consistent over split time steps',wl<1e-6,'max drift '+wl.toExponential(2)+' ly');
const sp=S.map(s=>Math.hypot(...s[14])*299792.458),fast=sp.filter(v=>v>550).length;add('All stellar speeds below galactic escape speed (~550 km/s)',fast===0,'max '+Math.max(...sp).toFixed(1)+' km/s; '+sp.filter(v=>v<100).length+' of '+S.length+' under 100 km/s');
const ins=S.filter(s=>Math.hypot(s[3]-C[0],s[4]-C[1],s[5]-C[2])<d.bubble.radius_pc*PC).length,fl=S.filter(s=>s[15]).length;add('Inside-bubble flags match the bubble model geometry',ins===fl,ins+' computed vs '+fl+' flagged');
const ds=S.map(s=>Math.hypot(s[3],s[4],s[5]));add('Every star lies within the 1,000 ly neighborhood',Math.max(...ds)<=1000.001,'max '+Math.max(...ds).toFixed(2)+' ly');
const sw=1e5/63241.077;add('Solar-system-to-bubble handoff distance',Math.abs(sw-1.5813)<0.001,'100,000 AU = '+sw.toFixed(4)+' ly');
return R}
if(typeof module!=='undefined')module.exports={PL,KB,AST,MO,TILT,HEL,VEC,PAR,ORB,LAG,SURF,PLANNED,GMS,GMP,EP,AUKM,D,EPS,kep,kepH,xyz,plEl,kbEl,kbM,plPos,kbPos,moonGeo,eq2ecl,helPos,vecPos,orbOff,observe,hypPos,physicsEvalsSolar,physicsEvalsBubble};
// ===== SCW1 chemistry layer (quantum -> atoms -> compounds) and SCW6 mining model =====
const ELEM={H:{Z:1,name:'hydrogen',w:1.008},Li:{Z:3,name:'lithium',w:6.94},C:{Z:6,name:'carbon',w:12.011},O:{Z:8,name:'oxygen',w:15.999},Fe:{Z:26,name:'iron',w:55.845},Co:{Z:27,name:'cobalt',w:58.933},Ni:{Z:28,name:'nickel',w:58.693},Pd:{Z:46,name:'palladium',w:106.42},Pt:{Z:78,name:'platinum',w:195.08},Au:{Z:79,name:'gold',w:196.97}};
const TROY_OZ_KG=0.0311034768;
const molar=f=>Object.entries(f).reduce((s,[e,n])=>s+ELEM[e].w*n,0);
const LI_IN_LCE=2*ELEM.Li.w/molar({Li:2,C:1,O:3});
// Prices: Skillings/MetalCharts indicative, 9 Nov 2026 08:00 UTC. Lithium quoted per tonne of carbonate (LCE).
const PRICES_USD_KG={Li:13864/1000/LI_IN_LCE,Ni:16268/1000,Co:19.89/0.45359237,Pt:1533.34/TROY_OZ_KG,Pd:1024.80/TROY_OZ_KG,Au:4086.14/TROY_OZ_KG};
const PRICE_DATE='2026-11-09';
// Chondrite compositions, ppm by mass: Lodders 2021, Space Sci Rev 217:44, Table 1.
const CHONDRITE={CI:{H:18600,Li:1.51,Fe:185620,Co:508,Ni:10950,Pd:0.558,Pt:0.931,Au:0.147},CM:{H:11500,Li:1.63,Fe:211000,Co:560,Ni:12500,Pd:0.63,Pt:1.1,Au:0.152},H:{H:800,Li:1.7,Fe:271500,Co:805,Ni:17100,Pd:0.845,Pt:1.58,Au:0.22},L:{H:1260,Li:1.9,Fe:218450,Co:600,Ni:12700,Pd:0.62,Pt:1.08,Au:0.16},LL:{H:1700,Li:2,Fe:198000,Co:480,Ni:10200,Pd:0.51,Pt:0.88,Au:0.14}};
// Iron-meteorite analog for M-types: typical literature magnitudes, NOT from Lodders 2021 (flagged unsourced).
const IRON_ANALOG={Li:0,Fe:900000,Co:5000,Ni:80000,Pd:4,Pt:10,Au:1};
// Spectral classes: JPL SBDB (Tholen / SMASS). Apophis and Phaethon from literature memory (flagged).
const TAXON={Ceres:['G','C',2.162],Vesta:['V','V',3.46],Pallas:['B','B',2.89],Hygiea:['C','C',null],Interamnia:['F','B',null],'Europa (52)':['CF','C',null],Davida:['C','C',null],Euphrosyne:['C','Cb',null],Patientia:['CU',null,null],Sylvia:['P','X',null],'Juno (3)':['S','Sk',null],Cybele:['P','Xc',null],Thisbe:['CF','B',null],Eunomia:['S','S',null],Psyche:['M','X',4.172],Bamberga:['CP',null,null],Doris:['CG','Ch',null],Ursula:['C','Xc',null],Camilla:['C','X',1.28],Hermione:['C','Ch',null],Apophis:['Sq','Sq',null,'memory'],Phaethon:['B','B',null,'memory']};
function analogFor(name){const t=TAXON[name];if(!t)return null;const c=(t[0]||'')+'/'+(t[1]||'');let comp,label,src,dens;
 if(/M/.test(t[0])){comp=IRON_ANALOG;label='iron-meteorite analog';src='typical literature values, unsourced here';dens=4.0}
 else if(/^S|Sq|Sk/.test(t[0])){comp=CHONDRITE.L;label='L ordinary chondrite';src='Lodders 2021';dens=2.7}
 else if(/V/.test(t[0])){comp=null;label='basaltic (HED) — no chondrite analog';src='not modeled';dens=3.4}
 else{comp=CHONDRITE.CI;label='CI carbonaceous chondrite';src='Lodders 2021';dens=1.7}
 return{taxonomy:c,analog:label,source:src,comp,density:t[2]||dens,density_measured:!!t[2],class_source:t[3]==='memory'?'literature (unverified)':'JPL SBDB'}}
function bodyMassKg(radiusKm,density){return 4/3*Math.PI*Math.pow(radiusKm*1e3,3)*density*1000}
const GM_EARTH=398600.4418,MU_KM=1.32712440018e11;
function hohmann(aAU,incDeg){const r1=AUKM,r2=aAU*AUKM,at=(r1+r2)/2,v1=Math.sqrt(MU_KM/r1),v2=Math.sqrt(MU_KM/r2),vt1=Math.sqrt(MU_KM*(2/r1-1/at)),vt2=Math.sqrt(MU_KM*(2/r2-1/at));
 const vinf=Math.abs(vt1-v1),rL=6371+400,dep=Math.sqrt(vinf*vinf+2*GM_EARTH/rL)-Math.sqrt(GM_EARTH/rL),arr=Math.sqrt(vt2*vt2+v2*v2-2*vt2*v2*Math.cos(incDeg*D));
 return{dv_depart_leo_kms:dep,dv_arrive_kms:arr,dv_total_kms:dep+arr,c3_km2s2:vinf*vinf,transfer_days:Math.PI*Math.sqrt(at*at*at/MU_KM)/86400}}
function eclLon(p){return Math.atan2(p[1],p[0])}
function launchWindows(k,jd0,count){const a=k[1],tt=Math.PI*Math.sqrt(Math.pow(a*AUKM+AUKM,3)/8/MU_KM)/86400,n2=2*Math.PI/(365.25*Math.pow(a,1.5)),phi=Math.PI-n2*tt;
 const f=j=>{let d=eclLon(kbPos(k,j))-eclLon(plPos(PL[2],j))-phi;d=Math.atan2(Math.sin(d),Math.cos(d));return d};const out=[];let prev=f(jd0);
 for(let j=jd0+5;j<jd0+365.25*40&&out.length<count;j+=5){const cur=f(j);if(prev<0&&cur>=0||prev>0&&cur<=0){if(Math.abs(cur-prev)<Math.PI){let lo=j-5,hi=j;for(let t=0;t<40;t++){const m=(lo+hi)/2;(Math.sign(f(m))===Math.sign(f(lo)))?lo=m:hi=m}out.push(lo)}}prev=cur}return{windows:out,transfer_days:tt}}
const ELEMENT_WORDS={lithium:'Li',li:'Li',nickel:'Ni',ni:'Ni',cobalt:'Co',co:'Co',platinum:'Pt',pt:'Pt',palladium:'Pd',pd:'Pd',gold:'Au',au:'Au',water:'H2O',h2o:'H2O',iron:'Fe',fe:'Fe'};
function parseTask(text){const t=text.toLowerCase().replace(/,/g,'');let el=null;for(const w of Object.keys(ELEMENT_WORDS)){if(new RegExp('\\b'+w+'\\b').test(t)){el=ELEMENT_WORDS[w];break}}
 let usd=null;const m=t.match(/\$?\s*([\d.]+)\s*(billion|bn|b|million|mm|m|thousand|k)?\b/);if(m&&/\$|million|billion|thousand|\bk\b|\bm\b/.test(t)){usd=parseFloat(m[1])*({billion:1e9,bn:1e9,b:1e9,million:1e6,mm:1e6,m:1e6,thousand:1e3,k:1e3}[m[2]]||1)}
 let maxAU=null;const d=t.match(/([\d.]+)\s*au/);if(d)maxAU=parseFloat(d[1]);const fromEarth=/from (the )?earth/.test(t);return{element:el,usd,maxAU,fromEarth}}
function findMiningTargets(q,jd){jd=jd||2461356.5;const el=q.element;if(!el)throw new Error('No element recognized. Try lithium, nickel, cobalt, platinum, palladium, gold, iron or water.');
 const earth=plPos(PL[2],jd),rows=[];KB.filter(k=>k[10]==='ast'||k[10]==='nea').forEach(k=>{const an=analogFor(k[0]);if(!an)return;const p=kbPos(k,jd),dist=q.fromEarth?Math.hypot(p[0]-earth[0],p[1]-earth[1],p[2]-earth[2]):Math.hypot(...p);
  if(q.maxAU&&dist>q.maxAU)return;let ppm=null,valPerKg=null;if(an.comp){if(el==='H2O')ppm=an.comp.H*18.015/2.016;else ppm=an.comp[el]}
  if(ppm===0)return;if(el!=='H2O'&&el!=='Fe'&&ppm!=null)valPerKg=PRICES_USD_KG[el]*ppm*1e-6;const mass=bodyMassKg(k[9],an.density),contained=ppm!=null?mass*ppm*1e-6:null;
  const ore=q.usd&&valPerKg?q.usd/valPerKg:null,hm=hohmann(k[1],k[3]);rows.push({name:k[0],taxonomy:an.taxonomy,class_source:an.class_source,analog:an.analog,composition_source:an.source,distance_au:dist,a_au:k[1],inc_deg:k[3],radius_km:k[9],density:an.density,density_measured:an.density_measured,body_mass_kg:mass,ppm,contained_kg:contained,value_per_kg_ore_usd:valPerKg,contained_value_usd:valPerKg!=null?valPerKg*mass:null,ore_needed_kg:ore,ore_needed_fraction:ore?ore/mass:null,...hm})});
 rows.sort((a,b)=>(a.ppm==null)-(b.ppm==null)||a.dv_total_kms-b.dv_total_kms);return{query:q,price_usd_per_kg:PRICES_USD_KG[el]||null,price_date:PRICE_DATE,targets:rows}}
function planMission(name,jd,opts){opts=opts||{};const k=KB.find(x=>x[0]===name);if(!k)throw new Error('Unknown target '+name);const hm=hohmann(k[1],k[3]),lw=launchWindows(k,jd||2461356.5,3);
 const isp=opts.isp_s||3000,launch=opts.launch_usd_per_kg_leo||10000,dry=opts.dry_mass_kg||2000,fixed=opts.fixed_cost_usd||400e6;const mr=Math.exp(hm.dv_total_kms*1000/(isp*9.80665)),wet=dry*mr;
 return{target:name,dv:hm,launch_windows_jd:lw.windows,launch_windows_utc:lw.windows.map(j=>new Date((j-2440587.5)*864e5).toISOString().slice(0,10)),arrival_after_days:Math.round(lw.transfer_days),
  cost_model:{isp_s:isp,dry_mass_kg:dry,mass_ratio:mr,wet_mass_leo_kg:wet,launch_cost_usd:wet*launch,fixed_cost_usd:fixed,total_usd:wet*launch+fixed,assumptions:'Game parameters, editable: one-way rendezvous, circular-coplanar Hohmann transfer with the plane change at arrival, solar-electric Isp 3000 s, $10,000/kg to LEO, $400M spacecraft and operations'}}}
function chemistryEvals(){const R=[],add=(n,p,d)=>R.push({name:n,pass:!!p,detail:d});
 add('Lithium mass fraction in Li₂CO₃ from atomic weights',Math.abs(LI_IN_LCE-0.18785)<1e-4,LI_IN_LCE.toFixed(5));
 add('Water mass per unit hydrogen (H₂O / 2H)',Math.abs(molar({H:2,O:1})/(2*ELEM.H.w)-8.937)<0.01,(molar({H:2,O:1})/(2*ELEM.H.w)).toFixed(3));
 add('Troy ounce definition',Math.abs(TROY_OZ_KG*1000-31.1034768)<1e-9,'31.1034768 g');
 add('Chondrite compositions sum below 100% (no double counting)',Object.values(CHONDRITE).every(c=>Object.values(c).reduce((s,x)=>s+x,0)<1e6),'max '+Math.max(...Object.values(CHONDRITE).map(c=>Object.values(c).reduce((s,x)=>s+x,0)/1e4)).toFixed(1)+'% of listed elements');
 const ce=bodyMassKg(469.7,2.162),gmC=62.6284;add('Ceres mass from radius × JPL density matches JPL GM',Math.abs(ce*6.6743e-20-gmC)/gmC<0.02,(ce*6.6743e-20).toFixed(2)+' vs '+gmC+' km³/s²');
 const ps=bodyMassKg(111,4.172),gmP=1.601;add('Psyche mass from radius × JPL density matches JPL GM',Math.abs(ps*6.6743e-20-gmP)/gmP<0.05,(ps*6.6743e-20).toFixed(3)+' vs '+gmP+' km³/s²');
 const hm=hohmann(1.5237,0);add('Hohmann Earth→Mars transfer time (~259 days)',Math.abs(hm.transfer_days-259)<3,hm.transfer_days.toFixed(1)+' d');
 return R}
if(typeof module!=='undefined')Object.assign(module.exports,{ELEM,PRICES_USD_KG,PRICE_DATE,CHONDRITE,TAXON,analogFor,bodyMassKg,hohmann,launchWindows,parseTask,findMiningTargets,planMission,chemistryEvals,LI_IN_LCE});
// ===== Parallel universe generator (sibling of SCW1 under SCW0) =====
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const SYL=['Ka','Vel','Or','Ri','Tha','Mu','Sen','Dor','Ix','Ae','Lun','Cor','Py','Zan','El','Nor','Qui','Sa','Te','Vor'];
function generateUniverse(seed,opts){opts=opts||{};seed=(seed>>>0)||1;const R=mulberry32(seed),u=(a,b)=>a+(b-a)*R(),gn=()=>{let s=0;for(let i=0;i<6;i++)s+=R();return s-3},word=n=>{let w='';for(let i=0;i<n;i++)w+=SYL[Math.floor(R()*SYL.length)].toLowerCase();return w[0].toUpperCase()+w.slice(1)};
 const Gs=opts.g_scale||1,Ms=+u(0.8,1.25).toFixed(3),L=+Math.pow(Ms,4).toFixed(3),mu=GMS*Ms*Gs,snow=2.7*Math.sqrt(L),star=word(2),hz=Math.sqrt(L);
 const planets=[];let a=u(0.25,0.45),i=0;while(a<45&&planets.length<9){const giant=a>snow;const m=giant?Math.exp(u(Math.log(8),Math.log(400))):Math.exp(u(Math.log(0.05),Math.log(2.5)));const rk=giant?Math.min(71000,6371*Math.pow(m,0.55)):6371*Math.pow(m,0.27);
  planets.push({name:star+' '+'bcdefghij'[i],kind:giant?(m>50?'gas giant':'ice giant'):'rocky planet',a:+a.toFixed(4),e:+u(0,0.09).toFixed(4),i:+u(0,3.5).toFixed(3),O:+u(0,360).toFixed(2),w:+u(0,360).toFixed(2),M0:+u(0,360).toFixed(2),mass_mearth:+m.toFixed(3),radius_km:Math.round(rk)});a*=u(1.45,1.95);i++}
 let home=planets.filter(p=>p.kind==='rocky planet').sort((x,y)=>Math.abs(x.a-hz)-Math.abs(y.a-hz))[0];if(!home)home=planets[0];home.home=true;
 const gi=planets.findIndex(p=>p.kind!=='rocky planet'),inner=gi>0?planets[gi-1].a*1.15:hz*1.8,outer=gi>0?planets[gi].a*0.85:snow*1.3;
 const asteroids=[],NA=opts.asteroids||400,lo=1,hi=600;for(let k=0;k<NA;k++){const D=lo*Math.pow(1-R()*(1-Math.pow(hi/lo,-1.5)),-1/1.5),aa=u(Math.min(inner,outer*0.9),outer),fx=(aa-inner)/(outer-inner+1e-9),r=R();
  const cls=r<0.05?'M':r<0.05+0.6*(1-fx)?'S':'C',base=cls==='M'?IRON_ANALOG:cls==='S'?CHONDRITE.L:CHONDRITE.CI,ore=R()<0.025;const comp={};Object.keys(base).forEach(el=>{let v=base[el]*Math.pow(10,0.15*gn());if(ore&&['Pt','Pd','Au','Li','Co','Ni'].includes(el))v*=Math.pow(10,u(1,2));comp[el]=+v.toPrecision(4)});
  asteroids.push({name:'('+(k+1)+') '+word(2),cls,ore,a:+aa.toFixed(4),e:+Math.min(0.35,Math.abs(gn()*0.08)).toFixed(4),i:+Math.abs(gn()*6).toFixed(3),O:+u(0,360).toFixed(2),w:+u(0,360).toFixed(2),M0:+u(0,360).toFixed(2),radius_km:+(D/2).toFixed(3),density:cls==='M'?4.0:cls==='S'?2.7:1.7,comp})}
 asteroids.sort((x,y)=>y.radius_km-x.radius_km);
 return{id:'SCW1~'+seed,seed,name:'Universe '+word(3)+' ('+seed+')',parent:'SCW0',epoch:2461356.5,
  constants:{choice:Gs===1?'equal to SCW1 (chosen by the generator; SCW0 does not fix constants)':'G scaled by '+Gs+' relative to SCW1',G_scale:Gs},
  galaxy:{name:word(3)+' Galaxy',type:'barred spiral',note:'single-galaxy path; generated, not observed'},star:{name:star,mass_msun:Ms,luminosity_lsun:L,snow_line_au:+snow.toFixed(3),habitable_zone_au:+hz.toFixed(3)},mu,planets,asteroids,home:home.name,belt_au:[+inner.toFixed(3),+outer.toFixed(3)]}}
function genPos(o,mu,jd,ep){const n=Math.sqrt(mu/Math.pow(o.a,3))/D;return xyz(o.a,o.e,o.i,o.O,o.w,kep((o.M0+n*(jd-ep))*D,o.e))}
function genHohmann(U,r1,r2,inc,homeMassEarth){const mu=U.mu*Math.pow(AUKM,3)/86400/86400,R1=r1*AUKM,R2=r2*AUKM,at=(R1+R2)/2,v1=Math.sqrt(mu/R1),v2=Math.sqrt(mu/R2),vt1=Math.sqrt(mu*(2/R1-1/at)),vt2=Math.sqrt(mu*(2/R2-1/at)),gm=GM_EARTH*homeMassEarth*(U.constants.G_scale||1),rL=6371*Math.pow(homeMassEarth,0.27)+400;
 const vinf=Math.abs(vt1-v1),dep=Math.sqrt(vinf*vinf+2*gm/rL)-Math.sqrt(gm/rL),arr=Math.sqrt(vt2*vt2+v2*v2-2*vt2*v2*Math.cos(inc*D));return{dv_depart_kms:dep,dv_arrive_kms:arr,dv_total_kms:dep+arr,transfer_days:Math.PI*Math.sqrt(at*at*at/mu)/86400}}
function genWindows(U,home,t,jd0,count){const tt=genHohmann(U,home.a,t.a,0,1).transfer_days,n2=Math.sqrt(U.mu/Math.pow(t.a,3)),phi=Math.PI-n2*tt,lon=(o,j)=>{const p=genPos(o,U.mu,j,U.epoch);return Math.atan2(p[1],p[0])},f=j=>{const d=lon(t,j)-lon(home,j)-phi;return Math.atan2(Math.sin(d),Math.cos(d))};
 const out=[];let prev=f(jd0);for(let j=jd0+5;j<jd0+365.25*40&&out.length<count;j+=5){const cur=f(j);if((prev<0&&cur>=0||prev>0&&cur<=0)&&Math.abs(cur-prev)<Math.PI){let lo2=j-5,hi2=j;for(let k=0;k<40;k++){const m=(lo2+hi2)/2;Math.sign(f(m))===Math.sign(f(lo2))?lo2=m:hi2=m}out.push(lo2)}prev=cur}return out}
function findMiningTargetsGen(U,q,jd){jd=jd||U.epoch;const el=q.element;if(!el)throw new Error('No element recognized. Try lithium, nickel, cobalt, platinum, palladium, gold, iron or water.');const home=U.planets.find(p=>p.home),hp=genPos(home,U.mu,jd,U.epoch),rows=[];
 U.asteroids.forEach(t=>{const p=genPos(t,U.mu,jd,U.epoch),dist=q.fromEarth?Math.hypot(p[0]-hp[0],p[1]-hp[1],p[2]-hp[2]):Math.hypot(...p);if(q.maxAU&&dist>q.maxAU)return;const ppm=el==='H2O'?t.comp.H*18.015/2.016:t.comp[el];if(!ppm)return;
  const vpk=(el!=='H2O'&&el!=='Fe')?PRICES_USD_KG[el]*ppm*1e-6:null,mass=bodyMassKg(t.radius_km,t.density),ore=q.usd&&vpk?q.usd/vpk:null,hm=genHohmann(U,home.a,t.a,t.i,home.mass_mearth);
  rows.push({name:t.name,taxonomy:t.cls+'-type'+(t.ore?' (enriched ore body)':''),analog:t.cls==='M'?'iron-meteorite analog':t.cls==='S'?'L ordinary chondrite':'CI carbonaceous chondrite',composition_source:'generated from chondrite analogs, ±0.15 dex scatter',ppm,value_per_kg_ore_usd:vpk,contained_kg:mass*ppm*1e-6,contained_value_usd:vpk!=null?vpk*mass:null,ore_needed_kg:ore,ore_needed_fraction:ore?ore/mass:null,distance_au:dist,a_au:t.a,radius_km:t.radius_km,...hm})});
 rows.sort((x,y)=>(x.ore_needed_fraction==null)-(y.ore_needed_fraction==null)||(x.ore_needed_fraction>1)-(y.ore_needed_fraction>1)||x.dv_total_kms-y.dv_total_kms);return{query:q,universe:U.id,price_usd_per_kg:PRICES_USD_KG[el]||null,price_date:PRICE_DATE,targets:rows}}
function planMissionGen(U,name,jd,opts){opts=opts||{};const t=U.asteroids.find(x=>x.name===name);if(!t)throw new Error('Unknown target '+name);const home=U.planets.find(p=>p.home),hm=genHohmann(U,home.a,t.a,t.i,home.mass_mearth),w=genWindows(U,home,t,jd||U.epoch,3);
 const isp=opts.isp_s||3000,launch=opts.launch_usd_per_kg_leo||10000,dry=opts.dry_mass_kg||2000,fixed=opts.fixed_cost_usd||400e6,mr=Math.exp(hm.dv_total_kms*1000/(isp*9.80665));
 return{target:name,home:home.name,dv:hm,launch_windows_jd:w,launch_windows_utc:w.map(j=>new Date((j-2440587.5)*864e5).toISOString().slice(0,10)),cost_model:{mass_ratio:mr,total_usd:dry*mr*launch+fixed}}}
function universeEvals(U){const R=[],add=(n,p,d)=>R.push({name:n,pass:!!p,detail:d}),bodies=U.planets.concat(U.asteroids.slice(0,60));let wE=0,wH=0;
 bodies.forEach(o=>{const f=j=>genPos(o,U.mu,j,U.epoch),P=2*Math.PI/Math.sqrt(U.mu/Math.pow(o.a,3)),h=P*2e-5,vel=j=>{const a1=f(j-h),b1=f(j+h),a2=f(j-2*h),b2=f(j+2*h);return[0,1,2].map(i=>(8*(b1[i]-a1[i])-(b2[i]-a2[i]))/(12*h))};const Es=[],Hs=[];
  for(let k=0;k<5;k++){const j=U.epoch+k*P/5,r=f(j),v=vel(j);Es.push((v[0]**2+v[1]**2+v[2]**2)/2-U.mu/Math.hypot(...r));Hs.push(Math.hypot(r[1]*v[2]-r[2]*v[1],r[2]*v[0]-r[0]*v[2],r[0]*v[1]-r[1]*v[0]))}
  const E0=-U.mu/(2*o.a);wE=Math.max(wE,...Es.map(e=>Math.abs(e-E0)/Math.abs(E0)));wH=Math.max(wH,(Math.max(...Hs)-Math.min(...Hs))/Hs[0])});
 add('Energy conserved on generated orbits ('+bodies.length+' bodies)',wE<1e-6,wE.toExponential(2)+' relative');add('Angular momentum conserved on generated orbits',wH<1e-6,wH.toExponential(2)+' relative');
 let ov=0;for(let k=1;k<U.planets.length;k++){const p0=U.planets[k-1],p1=U.planets[k];if(p0.a*(1+p0.e)>=p1.a*(1-p1.e))ov++}add('Planet orbits do not cross',ov===0,ov+' crossings');
 const U2=generateUniverse(U.seed,{g_scale:U.constants.G_scale,asteroids:U.asteroids.length});add('Generation is deterministic for seed '+U.seed,JSON.stringify(U2.planets)===JSON.stringify(U.planets)&&U2.asteroids[0].name===U.asteroids[0].name,'regenerated and compared');
 add('Chemistry inherited through SCW0 quantum laws still holds',chemistryEvals().every(r=>r.pass),'shared chemistry evals');
 add('Universe is a sibling of SCW1 with no cross-links',U.parent==='SCW0'&&!JSON.stringify(U).includes('"SCW1"'),'parent '+U.parent);
 return R}
if(typeof module!=='undefined')Object.assign(module.exports,{generateUniverse,genPos,genHohmann,genWindows,findMiningTargetsGen,planMissionGen,universeEvals,mulberry32});
// ===== SCW0 universe generator: sibling universes that inherit only SCW0 (quantum + structural) laws =====
function rng32(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const G_SI=6.67430e-11,MSUN=1.98892e30,KPC_M=3.0856775814913673e19;
function fitHalo(Gs,vTarget){const Mb=6e10*MSUN,Rd=3*KPC_M,vb=r=>{const x=r/Rd,m=Mb*(1-Math.exp(-x)*(1+x));return Math.sqrt(Gs*m/r)};let best=null;
 for(let vh=100e3;vh<=320e3;vh+=2e3)for(let rc=0.5;rc<=15;rc+=0.25){const R=rc*KPC_M;let err=0;for(let k=5;k<=25;k++){const r=k*KPC_M,vh2=vh*vh*(1-(R/r)*Math.atan(r/R)),v=Math.sqrt(vb(r)**2+vh2);err+=((v-vTarget)/vTarget)**2}if(!best||err<best.err)best={vh,rc,err}}
 const R=best.rc*KPC_M,curve=[];let mx=0;for(let k=1;k<=30;k++){const r=k*KPC_M,v=Math.sqrt(vb(r)**2+best.vh**2*(1-(R/r)*Math.atan(r/R)));curve.push([k,+(v/1e3).toFixed(1)]);if(k>=5&&k<=25)mx=Math.max(mx,Math.abs(v-vTarget)/vTarget)}
 const r25=25*KPC_M,Mh=best.vh**2*r25*(1-(R/r25)*Math.atan(r25/R))/Gs;return{v_flat_target_kms:vTarget/1e3,halo_v_kms:best.vh/1e3,halo_core_kpc:best.rc,halo_mass_25kpc_msun:Mh/MSUN,baryon_mass_msun:6e10,max_deviation_5_25kpc:mx,curve_kms:curve}}
function generateUniverse(seed){const r=rng32(seed),u=(a,b)=>a+(b-a)*r(),gauss=()=>{let s=0;for(let k=0;k<6;k++)s+=r();return(s-3)/Math.sqrt(0.5)};
 const gf=+u(0.9,1.1).toFixed(4),G=G_SI*gf,mstar=+u(0.8,1.3).toFixed(3),lum=+Math.pow(mstar,3.5).toFixed(3),GMs=GMS*gf*mstar,snow=2.7*Math.sqrt(lum),hz=Math.sqrt(lum);
 const halo=fitHalo(G,240e3);
 const planets=[];let a=u(0.3,0.5),tries=0;const MEARTH_MSUN=3.003e-6;
 while(planets.length<9&&a<60&&tries<400){tries++;const giant=a>snow,m=giant?u(10,400):u(0.05,3),hill=a*Math.cbrt(m*MEARTH_MSUN/(3*mstar));const prev=planets[planets.length-1];
  if(prev){const rh=((prev.a+a)/2)*Math.cbrt((prev.mass_earth+m)*MEARTH_MSUN/(3*mstar));if((a-prev.a)/rh<10){a*=1.05;continue}}
  planets.push({a:+a.toFixed(4),e:+u(0,0.08).toFixed(4),i:+u(0,4).toFixed(3),O:+u(0,360).toFixed(2),w:+u(0,360).toFixed(2),M0:+u(0,360).toFixed(2),mass_earth:+m.toFixed(3),radius_km:Math.round(giant?(m<50?u(20000,30000):u(55000,75000)):6371*Math.pow(m,0.27)),kind:giant?'giant planet':'rocky planet'});a*=u(1.45,2.0)}
 planets.forEach((p,k)=>p.name='Ψ'+seed%1000+'-'+'bcdefghijk'[k]);
 let gap=null;for(let k=1;k<planets.length;k++){const lo=planets[k-1],hi=planets[k];if(hi.a>snow*0.8&&!gap)gap=[lo.a,hi.a]}if(!gap)gap=[planets[planets.length-1].a*1.3,planets[planets.length-1].a*2];
 const rocky=planets.filter(p=>p.kind==='rocky planet'),home=(rocky.length?rocky:planets).reduce((b,p)=>Math.abs(Math.log(p.a/hz))<Math.abs(Math.log(b.a/hz))?p:b);home.home=true;
 const asteroids=[],cls=['C','C','C','C','C','C','S','S','S','M'];for(let k=0;k<24;k++){const c=cls[Math.floor(r()*cls.length)],rad=+(5*Math.pow(50,r())).toFixed(1),base=c==='M'?IRON_ANALOG:c==='S'?CHONDRITE.L:CHONDRITE.CI,comp={};
  Object.entries(base).forEach(([e,v])=>{comp[e]=+(v*Math.exp(0.3*gauss())).toPrecision(4)});const tot=Object.values(comp).reduce((s,x)=>s+x,0);if(tot>9.5e5)Object.keys(comp).forEach(e=>comp[e]=+(comp[e]*9.5e5/tot).toPrecision(4));
  const aa=Math.sqrt(gap[0]*gap[1])*Math.exp(0.15*gauss());asteroids.push({name:'Ψ'+seed%1000+'-A'+(k+1),a:+aa.toFixed(4),e:+u(0,0.25).toFixed(4),i:+u(0,18).toFixed(3),O:+u(0,360).toFixed(2),w:+u(0,360).toFixed(2),M0:+u(0,360).toFixed(2),radius_km:rad,taxonomy:c,density:c==='M'?4.0:c==='S'?2.7:1.7,comp,analog:(c==='M'?'iron-meteorite analog (unsourced base)':c==='S'?'L chondrite (Lodders 2021)':'CI chondrite (Lodders 2021)')+' × lognormal σ=0.3'})}
 return{id:'SCW1:psi-'+seed,seed,name:'Parallel universe Ψ-'+seed,constants:{c_m_s:299792458,h_J_s:6.62607015e-34,G_SI:G,G_factor_vs_SCW1:gf,fine_structure:'unchanged (chemistry identical to SCW1)'},star:{mass_msun:mstar,luminosity_lsun:lum,GM_au3_d2:GMs,snow_line_au:+snow.toFixed(3),habitable_zone_au:+hz.toFixed(3)},halo,planets,asteroids,belt_au:gap.map(x=>+x.toFixed(3)),epoch_jd:2461356.5}}
function psiPos(o,jd,GMs){const n=Math.sqrt(GMs/Math.pow(o.a,3))/D;return xyz(o.a,o.e,o.i,o.O,o.w,kep((o.M0+n*(jd-2461356.5))*D,o.e))}
function psiMiningSearch(U,q,jd){jd=jd||2461356.5;const el=q.element;if(!el)throw new Error('No element recognized. Try lithium, nickel, cobalt, platinum, palladium, gold, iron or water.');const home=U.planets.find(p=>p.home),hp=psiPos(home,jd,U.star.GM_au3_d2),rows=[];
 U.asteroids.forEach(t=>{const p=psiPos(t,jd,U.star.GM_au3_d2),dist=q.fromEarth?Math.hypot(p[0]-hp[0],p[1]-hp[1],p[2]-hp[2]):Math.hypot(...p);if(q.maxAU&&dist>q.maxAU)return;
  const ppm=el==='H2O'?t.comp.H*18.015/2.016:t.comp[el];if(!ppm)return;const vpk=(el!=='H2O'&&el!=='Fe')?PRICES_USD_KG[el]*ppm*1e-6:null,mass=bodyMassKg(t.radius_km,t.density),ore=q.usd&&vpk?q.usd/vpk:null;
  const mu=U.star.GM_au3_d2*AUKM**3/86400**2,r1=home.a*AUKM,r2=t.a*AUKM,at=(r1+r2)/2,vt1=Math.sqrt(mu*(2/r1-1/at)),vt2=Math.sqrt(mu*(2/r2-1/at)),v1=Math.sqrt(mu/r1),v2=Math.sqrt(mu/r2),arr=Math.sqrt(vt2*vt2+v2*v2-2*vt2*v2*Math.cos(t.i*D));
  rows.push({name:t.name,taxonomy:t.taxonomy,analog:t.analog,distance_au:dist,ppm,value_per_kg_ore_usd:vpk,body_mass_kg:mass,contained_value_usd:vpk!=null?vpk*mass:null,contained_kg:mass*ppm*1e-6,ore_needed_kg:ore,ore_needed_fraction:ore?ore/mass:null,dv_from_home_orbit_kms:Math.abs(vt1-v1)+arr,transfer_days:Math.PI*Math.sqrt(at**3/mu)/86400})});
 rows.sort((a,b)=>((a.ore_needed_kg??Infinity)-(b.ore_needed_kg??Infinity))||(a.dv_from_home_orbit_kms-b.dv_from_home_orbit_kms));return{universe:U.id,home:home.name,query:q,price_usd_per_kg:PRICES_USD_KG[el]||null,price_date:PRICE_DATE+' (SCW1 market prices, applied hypothetically)',targets:rows}}
function universeEvals(U){const R=[],add=(n,p,d)=>R.push({name:n,pass:!!p,detail:d}),GMs=U.star.GM_au3_d2,cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const U2=generateUniverse(U.seed);add('Deterministic: the same seed regenerates the identical universe',JSON.stringify(U2)===JSON.stringify(U),'seed '+U.seed);
 add('Physical constants are set locally (G = '+U.constants.G_factor_vs_SCW1+' × SCW1), not inherited from SCW1',U.constants.G_factor_vs_SCW1>=0.9&&U.constants.G_factor_vs_SCW1<=1.1,'G = '+U.constants.G_SI.toExponential(5)+' m³ kg⁻¹ s⁻²');
 const all=U.planets.concat(U.asteroids);let wE=0,wH=0,wK=0;all.forEach(o=>{const f=j=>psiPos(o,j,GMs),h=Math.pow(o.a,1.5)*365.25*2e-5,vel=j=>{const a=f(j-h),b=f(j+h),a2=f(j-2*h),b2=f(j+2*h);return[0,1,2].map(i=>(8*(b[i]-a[i])-(b2[i]-a2[i]))/(12*h))};const Es=[],Hs=[];
  for(let k=0;k<5;k++){const j=2461356.5+k*Math.pow(o.a,1.5)*73,rr=f(j),v=vel(j);Es.push((v[0]**2+v[1]**2+v[2]**2)/2-GMs/Math.hypot(...rr));Hs.push(Math.hypot(...cross(rr,v)))}const E0=-GMs/(2*o.a);wE=Math.max(wE,...Es.map(e=>Math.abs(e-E0)/Math.abs(E0)));wH=Math.max(wH,(Math.max(...Hs)-Math.min(...Hs))/Hs[0]);
  const P=2*Math.PI*Math.sqrt(o.a**3/GMs),n=Math.sqrt(GMs/o.a**3);wK=Math.max(wK,Math.abs(P*n-2*Math.PI))});
 add('Energy conserved on all '+all.length+' generated orbits (with this universe\'s G)',wE<1e-6,wE.toExponential(2)+' relative');add('Angular momentum conserved on all generated orbits',wH<1e-6,wH.toExponential(2)+' relative');add("Kepler's third law holds with the local G·M★",wK<1e-12,'max error '+wK.toExponential(2));
 let ms=Infinity;for(let k=1;k<U.planets.length;k++){const p=U.planets[k-1],q=U.planets[k],rh=((p.a+q.a)/2)*Math.cbrt((p.mass_earth+q.mass_earth)*3.003e-6/(3*U.star.mass_msun));ms=Math.min(ms,(q.a-p.a)/rh)}add('Planet spacing is dynamically stable (≥ 10 mutual Hill radii)',ms>=10,'minimum '+ms.toFixed(1)+' Hill radii');
 add('Dark-matter halo fitted to the app\'s flat 240 km/s Milky Way curve (5–25 kpc)',U.halo.max_deviation_5_25kpc<0.05,'max deviation '+(U.halo.max_deviation_5_25kpc*100).toFixed(2)+'%, halo '+U.halo.halo_mass_25kpc_msun.toExponential(2)+' M☉ within 25 kpc');
 add('Asteroid compositions stay below 100% by mass',U.asteroids.every(a=>Object.values(a.comp).reduce((s,x)=>s+x,0)<1e6),U.asteroids.length+' asteroids');
 const h1=fitHalo(G_SI,240e3);add('Halo scales with G: weaker gravity needs more dark matter for the same curve',(U.constants.G_factor_vs_SCW1<1)===(U.halo.halo_mass_25kpc_msun>h1.halo_mass_25kpc_msun)||Math.abs(U.constants.G_factor_vs_SCW1-1)<0.005,'SCW1 halo '+h1.halo_mass_25kpc_msun.toExponential(2)+' vs Ψ '+U.halo.halo_mass_25kpc_msun.toExponential(2)+' M☉');
 return R}
if(typeof module!=='undefined')Object.assign(module.exports,{generateUniverse,psiPos,psiMiningSearch,universeEvals,fitHalo});
// ===== Exotic universe Ω: a medium denser than its black holes (SCW0 sibling with a changed law set) =====
const C_SI=299792458;
const bhDensity=(Mkg,G)=>3*Math.pow(C_SI,6)/(32*Math.PI*Math.pow(G,3)*Mkg*Mkg);
const bhRs=(Mkg,G)=>2*G*Mkg/(C_SI*C_SI);
function generateExotic(seed){const r=rng32(seed*31+7),u=(a,b)=>a+(b-a)*r(),G=G_SI,rho=Math.pow(10,u(17.5,19)),omega=Math.sqrt(4*Math.PI*G*rho/3),Mstar=Math.sqrt(3*Math.pow(C_SI,6)/(32*Math.PI*Math.pow(G,3)*rho)),Rm=2000*AUKM*1e3;
 const bhs=[];for(let k=0;k<40;k++){const logM=k<14?u(0.5,1.8):k<26?u(2,5):u(5,10),M=Math.pow(10,logM)*MSUN,Rs=bhRs(M,G),dens=bhDensity(M,G),kappa=1-rho/dens,s0=Math.sqrt(Math.abs(kappa))*omega;
  const rr=kappa>0?Math.max(Rs*2,u(0.05,0.5)*C_SI/s0):Rm*Math.cbrt(u(0.001,0.6)),z=2*u(0,1)-1,th=u(0,2*Math.PI),q=Math.sqrt(1-z*z),x0=[rr*q*Math.cos(th),rr*q*Math.sin(th),rr*z];
  const vs=kappa>0?s0*rr*u(0,0.5):Math.min(omega*rr*u(0,0.3),0.1*C_SI),z2=2*u(0,1)-1,t2=u(0,2*Math.PI),q2=Math.sqrt(1-z2*z2),v0=[vs*q2*Math.cos(t2),vs*q2*Math.sin(t2),vs*z2];
  bhs.push({name:'Ω'+seed%1000+'-BH'+(k+1),mass_msun:+(M/MSUN).toPrecision(4),rs_m:Rs,density_kg_m3:dens,kappa,fate:kappa<0?'floats to the boundary':'sinks: closed orbit through the center',x0,v0})}
 return{id:'SCW1:omega-'+seed,seed,name:'Exotic universe Ω-'+seed,medium_density_kg_m3:rho,G_SI:G,omega_rad_s:omega,period_s:2*Math.PI/omega,float_threshold_msun:Mstar/MSUN,medium_radius_m:Rm,medium_own_horizon_radius_m:Math.sqrt(3*C_SI*C_SI/(8*Math.PI*G*rho)),
  laws:{inherited:'SCW0 quantum and structural laws',replaced:'General-relativistic horizon formation does not apply to the continuous medium; gravity inside it is Newtonian',kept:'Compact objects keep Schwarzschild horizons and densities; nothing moves faster than light'},bhs}}
function exoticPos(U,b,t){const w=U.omega_rad_s,R=U.medium_radius_m,k=b.kappa;let x,v;
 if(k>0){const s=Math.sqrt(k)*w;x=b.x0.map((x0,i)=>x0*Math.cos(s*t)+b.v0[i]/s*Math.sin(s*t));v=b.x0.map((x0,i)=>-x0*s*Math.sin(s*t)+b.v0[i]*Math.cos(s*t))}
 else{const s=Math.sqrt(-k)*w,r0=Math.hypot(...b.x0),dir=b.x0.map(c=>c/r0),st=Math.min(s*t,700);x=b.x0.map((x0,i)=>x0*Math.cosh(st)+b.v0[i]/s*Math.sinh(st));v=b.x0.map((x0,i)=>x0*s*Math.sinh(st)+b.v0[i]*Math.cosh(st));
  const rc=r0+C_SI*t;if(!isFinite(Math.hypot(...x))||Math.hypot(...x)>rc||Math.hypot(...v)>C_SI){x=dir.map(c=>c*rc);v=dir.map(c=>c*C_SI)}}
 const d=Math.hypot(...x);if(d>=R)return{x:x.map(c=>c*R/d),v:[0,0,0],at_boundary:true};return{x,v,at_boundary:false}}
function exoticSurfaceTime(U,b){if(b.kappa>=0)return null;let lo=0,hi=1;while(!exoticPos(U,b,hi).at_boundary&&hi<1e10)hi*=2;for(let k=0;k<60;k++){const m=(lo+hi)/2;exoticPos(U,b,m).at_boundary?hi=m:lo=m}return hi}
function exoticEvals(U){const R=[],add=(n,p,d)=>R.push({name:n,pass:!!p,detail:d}),w=U.omega_rad_s,rho=U.medium_density_kg_m3;
 add('Deterministic: same seed, same universe',JSON.stringify(generateExotic(U.seed))===JSON.stringify(U),'seed '+U.seed);
 const Ms=U.float_threshold_msun*MSUN;add('At the threshold mass a black hole has exactly the medium density',Math.abs(bhDensity(Ms,U.G_SI)-rho)/rho<1e-12,'threshold '+U.float_threshold_msun.toPrecision(3)+' M☉');
 const fl=U.bhs.filter(b=>b.kappa<0),sk=U.bhs.filter(b=>b.kappa>0);add('Black holes above the threshold mass float; below it they sink',fl.every(b=>b.mass_msun>U.float_threshold_msun)&&sk.every(b=>b.mass_msun<U.float_threshold_msun),fl.length+' float, '+sk.length+' sink');
 let wr=0;fl.forEach(b=>{const t=exoticSurfaceTime(U,b),p=exoticPos(U,b,t);wr=Math.max(wr,Math.abs(Math.hypot(...p.x)-U.medium_radius_m)/U.medium_radius_m)});add('Every floating black hole reaches the boundary (the gate to SCW0)',fl.every(b=>exoticSurfaceTime(U,b)<1e10)&&wr<1e-9,'fastest '+(Math.min(...fl.map(b=>exoticSurfaceTime(U,b)))/86400).toFixed(2)+' d (light-speed limited), slowest '+(Math.max(...fl.map(b=>exoticSurfaceTime(U,b)))/86400/365.25).toPrecision(3)+' yr (just above threshold)');
 let wc=0;sk.forEach(b=>{const T=2*Math.PI/(Math.sqrt(b.kappa)*w),p=exoticPos(U,b,T);wc=Math.max(wc,Math.hypot(...p.x.map((c,i)=>c-b.x0[i]))/Math.hypot(...b.x0))});add("Sinking orbits close after one period (Bertrand's spring-law case)",wc<1e-9,'max return error '+wc.toExponential(2));
 let wi=0;sk.forEach(b=>{const T=2*Math.PI/(Math.sqrt(b.kappa)*w),b2={...b,x0:b.x0.map(c=>c*0.3),v0:b.v0.map(c=>c*0.3)},p=exoticPos(U,b2,T);wi=Math.max(wi,Math.hypot(...p.x.map((c,i)=>c-b2.x0[i]))/Math.hypot(...b2.x0))});add('Sinking periods do not depend on orbit size (a 0.3× orbit returns in the same time)',wi<1e-9,'max return error '+wi.toExponential(2));
 let wE=0;sk.slice(0,6).forEach(b=>{const k=b.kappa*w*w,E=t=>{const p=exoticPos(U,b,t);return 0.5*(p.v[0]**2+p.v[1]**2+p.v[2]**2)+0.5*k*(p.x[0]**2+p.x[1]**2+p.x[2]**2)},E0=E(0);[1e-5,7e-5,2e-4].forEach(t=>wE=Math.max(wE,Math.abs(E(t)-E0)/E0))});add('Energy conserved for sinking black holes (effective spring potential)',wE<1e-9,wE.toExponential(2)+' relative');
 let vmax=0;fl.forEach(b=>{const T=exoticSurfaceTime(U,b);for(let k=0;k<=50;k++){const p=exoticPos(U,b,T*k/51);vmax=Math.max(vmax,Math.hypot(...p.v))}});sk.forEach(b=>{const T=2*Math.PI/(Math.sqrt(b.kappa)*w);for(let k=0;k<=200;k++){const p=exoticPos(U,b,T*k/200);vmax=Math.max(vmax,Math.hypot(...p.v))}});add('No black hole, floating or sinking, moves faster than light (causality kept)',vmax<=C_SI*(1+1e-12),'max speed '+(vmax/C_SI).toFixed(4)+' c');
 add('Declared law change: the medium is larger than its own horizon radius, so GR horizon law is replaced',U.medium_radius_m>U.medium_own_horizon_radius_m&&/replaced|does not apply/.test(U.laws.replaced),'medium '+(U.medium_radius_m/AUKM/1e3).toFixed(0)+' AU vs its own horizon '+(U.medium_own_horizon_radius_m/1e3).toFixed(1)+' km');
 return R}
if(typeof module!=='undefined')Object.assign(module.exports,{generateExotic,exoticPos,exoticSurfaceTime,exoticEvals,bhDensity,bhRs});
// ===== Experiment: extract and return the priced asteroid metals (SCW6 campaign) =====
// World mine production 2025: Ni 3.9 Mt, Au 3,300 t, Li 290,000 t (USGS MCS 2026). Co, Pt, Pd approximate (not verified this session).
const WORLD_PROD_KG={Ni:3.9e9,Au:3.3e6,Li:2.9e8,Co:2.9e8,Pt:1.7e5,Pd:1.9e5};
const WORLD_PROD_SRC={Ni:'USGS MCS 2026',Au:'USGS MCS 2026',Li:'USGS MCS 2026',Co:'approximate',Pt:'approximate',Pd:'approximate'};
const SUN_L_W=3.828e26;
function extractionCampaign(o){o=Object.assign({start_year:2035,seed_rate_kg_yr:1e6,doubling_years:3,cap_kg_yr:1e12,efficiency:0.5,elasticity:0.5},o||{});
 const els=['Ni','Co','Pt','Pd','Au','Li'],bodies=[];KB.forEach(k=>{const a=analogFor(k[0]);if(!a||!a.comp)return;const m=bodyMassKg(k[9],a.density),hm=hohmann(k[1],k[3]),metals={};let mm=0,val=0;els.forEach(e=>{const kg=m*(a.comp[e]||0)*1e-6;metals[e]=kg;mm+=kg;val+=kg*PRICES_USD_KG[e]});
  bodies.push({name:k[0],metal_kg:mm,rock_kg:m,metals,value_usd:val,dv_return_kms:hm.dv_arrive_kms,energy_J:mm*0.5*Math.pow(hm.dv_arrive_kms*1000,2)/o.efficiency})});
 bodies.sort((a,b)=>a.dv_return_kms-b.dv_return_kms);const M=bodies.reduce((s,b)=>s+b.metal_kg,0),V=bodies.reduce((s,b)=>s+b.value_usd,0),E=bodies.reduce((s,b)=>s+b.energy_J,0),rock=bodies.reduce((s,b)=>s+b.rock_kg,0);
 const tRamp=o.doubling_years*Math.log2(o.cap_kg_yr/o.seed_rate_kg_yr),mRamp=o.seed_rate_kg_yr*o.doubling_years/Math.LN2*(o.cap_kg_yr/o.seed_rate_kg_yr-1),tTotal=mRamp>=M?o.doubling_years*Math.log2(1+M*Math.LN2/(o.seed_rate_kg_yr*o.doubling_years)):tRamp+(M-mRamp)/o.cap_kg_yr;
 const mix={};els.forEach(e=>mix[e]=bodies.reduce((s,b)=>s+b.metals[e],0)/M);
 const market=els.map(e=>{const q=o.cap_kg_yr*mix[e],f=Math.pow(1+q/WORLD_PROD_KG[e],-1/o.elasticity);return{element:e,space_supply_kg_yr:q,world_production_kg_yr:WORLD_PROD_KG[e],supply_multiple:q/WORLD_PROD_KG[e],price_factor:f,price_usd_kg:PRICES_USD_KG[e]*f,revenue_usd_yr:q*PRICES_USD_KG[e]*f,source:WORLD_PROD_SRC[e]}});
 const revYr=market.reduce((s,m)=>s+m.revenue_usd_yr,0);let cum=0,t=0;const order=bodies.map(b=>{const dur=b.metal_kg/o.cap_kg_yr;const r={name:b.name,starts_year:Math.round(o.start_year+tRamp+t),years:dur,value_at_today_prices:b.value_usd,dv_return_kms:+b.dv_return_kms.toFixed(2)};t+=dur;return r});
 return{assumptions:o,totals:{bodies:bodies.length,metal_kg:M,rock_kg:rock,metal_fraction_of_rock:M/rock,value_today_usd:V,energy_J:E,energy_sun_seconds:E/SUN_L_W,ramp_years:tRamp,total_years:tTotal,finish_year:o.start_year+tTotal},
  market_at_cap:market,realized_revenue_usd_yr:revYr,realized_total_usd:revYr*(tTotal-tRamp),realized_fraction_of_headline:revYr*(tTotal-tRamp)/V,schedule:order}}
function extractionEvals(){const R=[],add=(n,p,d)=>R.push({name:n,pass:!!p,detail:d}),c=extractionCampaign();
 add('Campaign values the same 21 bodies as the tooltips',c.totals.bodies===21&&Math.abs(c.totals.value_today_usd-4.59737339587e20)/4.59737339587e20<1e-9,'$'+(c.totals.value_today_usd/1e18).toFixed(2)+' quintillion');
 const sum=c.schedule.reduce((s,x)=>s+x.years,0);add('Schedule accounts for every kilogram (mass conservation)',Math.abs(sum*c.assumptions.cap_kg_yr-c.totals.metal_kg)/c.totals.metal_kg<1e-12,sum.toExponential(3)+' years at cap');
 const lo=extractionCampaign({elasticity:0.5}),hi=extractionCampaign({elasticity:2});add('More elastic demand loses less price (economics sanity)',hi.market_at_cap[0].price_factor>lo.market_at_cap[0].price_factor,'nickel price factor '+lo.market_at_cap[0].price_factor.toExponential(2)+' → '+hi.market_at_cap[0].price_factor.toExponential(2));
 const fast=extractionCampaign({cap_kg_yr:1e13});add('A 10× larger fleet finishes about 10× sooner',Math.abs(c.totals.total_years/fast.totals.total_years-10)/10<0.01,(c.totals.total_years/fast.totals.total_years).toFixed(3)+'×');
 const ap=KB.find(k=>k[0]==='Apophis'),an=analogFor('Apophis'),apM=bodyMassKg(ap[9],an.density)*['Ni','Co','Pt','Pd','Au','Li'].reduce((s,e)=>s+(an.comp[e]||0)*1e-6,0),apE=apM*0.5*Math.pow(hohmann(ap[1],ap[3]).dv_arrive_kms*1000,2)/0.5,cE=extractionCampaign();add('Return energy recomputed independently for Apophis (½·m·Δv² ÷ 0.5)',Math.abs(apE/apM-0.5*Math.pow(cE.schedule[0].dv_return_kms*1000,2)/0.5)/(apE/apM)<0.01,(apE/apM/1e6).toFixed(3)+' MJ per kg returned');
 return R}
if(typeof module!=='undefined')Object.assign(module.exports,{extractionCampaign,extractionEvals,WORLD_PROD_KG});
// ===== Trip planner for any SCW6 body (planets, asteroids, KBOs; moons via their planet) =====
function bodyOrbit(name){const p=PL.find(x=>x[0]===name);if(p)return{name,a:p[1][0],i:p[1][2],pos:j=>plPos(p,j),kind:'planet'};const k=KB.find(x=>x[0]===name);if(k)return{name,a:k[1],i:k[3],pos:j=>kbPos(k,j),kind:'minor body'};
 for(const par of Object.keys(MO)){if(MO[par].some(m=>m[0]===name)){const b=bodyOrbit(par);return Object.assign({},b,{name,via:par,kind:'moon of '+par})}}return null}
function planTrip(name,jd,opts){jd=jd||2461356.5;const b=bodyOrbit(name);if(!b)throw new Error('No orbit known for '+name);if(name==='Earth')throw new Error('You are already on Earth. Pick another destination.');
 const hm=hohmann(b.a,b.i),tt=hm.transfer_days,n2=2*Math.PI/(365.25*Math.pow(b.a,1.5)),phi=Math.PI-n2*tt,f=j=>{let d=eclLon(b.pos(j))-eclLon(plPos(PL[2],j))-phi;return Math.atan2(Math.sin(d),Math.cos(d))},w=[];let prev=f(jd);
 for(let j=jd+5;j<jd+365.25*60&&w.length<3;j+=5){const cur=f(j);if((prev<0&&cur>=0||prev>0&&cur<=0)&&Math.abs(cur-prev)<Math.PI){let lo=j-5,hi=j;for(let t=0;t<40;t++){const m=(lo+hi)/2;Math.sign(f(m))===Math.sign(f(lo))?lo=m:hi=m}w.push(lo)}prev=cur}
 opts=opts||{};const isp=opts.isp_s||3000,launch=opts.launch_usd_per_kg_leo||10000,dry=opts.dry_mass_kg||2000,fixed=opts.fixed_cost_usd||400e6,mr=Math.exp(hm.dv_total_kms*1000/(isp*9.80665));
 return{target:name,kind:b.kind,via:b.via||null,a_au:b.a,dv:hm,transfer_days:tt,launch_windows_utc:w.map(j=>new Date((j-2440587.5)*864e5).toISOString().slice(0,10)),launch_windows_jd:w,cost_model:{isp_s:isp,dry_mass_kg:dry,mass_ratio:mr,wet_mass_leo_kg:dry*mr,total_usd:dry*mr*launch+fixed,assumptions:'Circular-coplanar Hohmann transfer from low Earth orbit, plane change at arrival, solar-electric Isp 3000 s, $10,000/kg to LEO, $400M spacecraft and operations'+(b.via?'; moon trips use the planet transfer only, without the moon capture':'')}}}
function parseTrip(text,names){const t=text.toLowerCase();if(!/\b(trip|mission|travel|fly|go|route|journey|transfer|visit|launch|get to|land)\b/.test(t))return null;const hits=names.filter(n=>new RegExp('\\b'+n.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ \(.+\)$/,'')+'\\b').test(t));return hits.sort((a,b)=>b.length-a.length)[0]||null}
if(typeof module!=='undefined')Object.assign(module.exports,{planTrip,parseTrip,bodyOrbit});
// ---- Human-made object routes (v0.12). Launch, flyby, arrival and landing dates from mission records (recalled, see ROUTE_NOTE).
// Rules: hidden before launch; leaves from Earth at launch; passes through each flyby body on its date; rides its host after arrival.
// Between dated waypoints the path is interpolated in heliocentric radius and prograde angle (an arc, not an integrated trajectory).
const ROUTE_NOTE='Launch, flyby and arrival dates are recalled from mission records, not fetched this session. Between dated waypoints the path is an interpolated arc, not an integrated trajectory.';
const ROUTES={
'Voyager 1':{l:'1977-09-05',w:[['Jupiter','1979-03-05'],['Saturn','1980-11-12']],kind:'escape'},
'Voyager 2':{l:'1977-08-20',w:[['Jupiter','1979-07-09'],['Saturn','1981-08-25'],['Uranus','1986-01-24'],['Neptune','1989-08-25']],kind:'escape'},
'New Horizons':{l:'2006-01-19',w:[['Jupiter','2007-02-28'],['Pluto','2015-07-14'],['Arrokoth','2019-01-01']],kind:'escape'},
'Pioneer 10':{l:'1972-03-03',w:[['Jupiter','1973-12-04']],kind:'escape'},
'Pioneer 11':{l:'1973-04-06',w:[['Jupiter','1974-12-03'],['Saturn','1979-09-01']],kind:'escape'},
'Europa Clipper':{l:'2024-10-14',w:[['Mars','2025-03-01']],m:['2025-04-01','2026-11-03'],f:[['Earth','2026-12-03']],arrive:['Jupiter','2030-04-11'],kind:'cruise'},
'JUICE':{l:'2023-04-14',w:[['Earth','2024-08-20'],['Venus','2025-08-31']],m:['2025-10-01','2026-08-30'],f:[['Earth','2026-09-29'],['Earth','2029-01-18']],arrive:['Jupiter','2031-07-15'],kind:'cruise'},
'Lucy':{l:'2021-10-16',w:[['Earth','2022-10-16'],['Earth','2024-12-12']],m:['2025-01-12',null],kind:'cruise'},
'Psyche (spacecraft)':{l:'2023-10-13',m:['2023-11-13','2026-04-15'],f:[['Mars','2026-05-15']],arrive:['Psyche','2029-08-01'],kind:'cruise'},
'Hera':{l:'2024-10-07',w:[['Mars','2025-03-12']],m:['2025-04-12',null],kind:'cruise'},
'Tesla Roadster':{l:'2018-02-06',m:['2018-03-08',null],kind:'cruise'},
'Solar Orbiter':{l:'2020-02-10',m:['2020-03-10',null],kind:'cruise'},
'Parker Solar Probe':{l:'2018-08-12',m:['2018-09-12',null],kind:'cruise'},
'STEREO-A':{l:'2006-10-26',m:['2007-01-26',null],kind:'cruise'},
'Kepler':{l:'2009-03-07',m:['2009-04-07',null],kind:'cruise'},
'Spitzer':{l:'2003-08-25',m:['2003-09-25',null],kind:'cruise'},
'ISS':{l:'1998-11-20'},'Tiangong':{l:'2021-04-29'},'Hubble':{l:'1990-04-24'},'SL-16 rocket bodies':{l:'1985-04-13',note:'first Zenit-2 launch; individual stages went up later'},
'Envisat':{l:'2002-03-01'},'Terra':{l:'1999-12-18'},'ADEOS-II':{l:'2002-12-14'},'Aura':{l:'2004-07-15'},'Aqua':{l:'2002-05-04'},'Landsat 9':{l:'2021-09-27'},
'NOAA-20':{l:'2017-11-18'},'Suomi NPP':{l:'2011-10-28'},'EchoStar XXIV (Jupiter 3)':{l:'2023-07-29'},'TerreStar-1':{l:'2009-07-01'},'ViaSat-3 Americas':{l:'2023-05-01'},
'Chandra':{l:'1999-07-23'},'XMM-Newton':{l:'1999-12-10'},'GPS III':{l:'2018-12-23',note:'first GPS III satellite'},'Galileo':{l:'2011-10-21',note:'first operational Galileo pair'},'TESS':{l:'2018-04-18'},
'Chandrayaan-2 orbiter':{l:'2019-07-22',arrive:['Moon','2019-08-20']},'LRO':{l:'2009-06-18',arrive:['Moon','2009-06-23']},'Queqiao-2':{l:'2024-03-20',arrive:['Moon','2024-03-24']},
'Danuri':{l:'2022-08-04',arrive:['Moon','2022-12-16']},'ARTEMIS P1':{l:'2007-02-17',arrive:['Moon','2011-06-27'],note:'launched as THEMIS B, moved to the Moon'},'ARTEMIS P2':{l:'2007-02-17',arrive:['Moon','2011-07-17'],note:'launched as THEMIS C, moved to the Moon'},
'MRO':{l:'2005-08-12',arrive:['Mars','2006-03-10']},'TGO':{l:'2016-03-14',arrive:['Mars','2016-10-19']},'Tianwen-1 orbiter':{l:'2020-07-23',arrive:['Mars','2021-02-10']},
'MAVEN':{l:'2013-11-18',arrive:['Mars','2014-09-22']},'Emirates Hope':{l:'2020-07-19',arrive:['Mars','2021-02-09']},'Mars Express':{l:'2003-06-02',arrive:['Mars','2003-12-25']},'Mars Odyssey':{l:'2001-04-07',arrive:['Mars','2001-10-24']},
'Juno':{l:'2011-08-05',w:[['Earth','2013-10-09']],arrive:['Jupiter','2016-07-05']},
'BepiColombo':{l:'2018-10-20',w:[['Earth','2020-04-10'],['Venus','2020-10-15'],['Venus','2021-08-10'],['Mercury','2021-10-01'],['Mercury','2022-06-23'],['Mercury','2023-06-19'],['Mercury','2024-09-04'],['Mercury','2024-12-01'],['Mercury','2025-01-08']],arrive:['Mercury','2026-11-21']},
'JWST':{l:'2021-12-25',arrive:['SEL2','2022-01-24']},'Spektr-RG':{l:'2019-07-13',arrive:['SEL2','2019-10-21']},'Euclid':{l:'2023-07-01',arrive:['SEL2','2023-07-28']},
'SOHO':{l:'1995-12-02',arrive:['SEL1','1996-02-14']},'Aditya-L1':{l:'2023-09-02',arrive:['SEL1','2024-01-06']},'Wind':{l:'1994-11-01',arrive:['SEL1','2004-06-01'],note:'reached L1 for good in 2004 after years of other orbits'},
'ACE':{l:'1997-08-25',arrive:['SEL1','1997-12-12']},'DSCOVR':{l:'2015-02-11',arrive:['SEL1','2015-06-08']},'Queqiao':{l:'2018-05-20',arrive:['EML2','2018-06-14']},
'Perseverance':{l:'2020-07-30',arrive:['Mars','2021-02-18']},'Curiosity':{l:'2011-11-26',arrive:['Mars','2012-08-06']},'Zhurong':{l:'2020-07-23',arrive:['Mars','2021-05-14']}};
function dateJD(s){const m=/^(-?\d+)-(\d+)-(\d+)/.exec(s);let y=+m[1],mo=+m[2],d=+m[3];if(mo<=2){y--;mo+=12}const a=Math.floor(y/100),b=2-a+Math.floor(a/4);return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(mo+1))+d+b-1524.5}
// Planned missions: launch from the plan text; cruise length = Hohmann transfer to the destination (SEL1/SEL2: 30 days)
const MONTHS={january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12};
function planLaunchJD(txt){const t=String(txt).toLowerCase(),y=+(/(\d{4})/.exec(t)||[0,0])[1];if(!y)return null;let mo=1;for(const k in MONTHS)if(t.includes(k)){mo=MONTHS[k];break}if(/end of/.test(t))mo=12;else if(/spring/.test(t))mo=4;else if(/summer/.test(t))mo=7;else if(/autumn|fall/.test(t))mo=10;else if(/h2/.test(t))mo=7;return dateJD(y+'-'+String(mo).padStart(2,'0')+'-01')}
function bodyAt(name,jd){if(name==='Sun')return[0,0,0];if(name==='SEL2'||name==='SEL1'){const e=bodyAt('Earth',jd),k=name==='SEL2'?1.01003:0.98997;return e.map(c=>c*k)}
 if(name==='Moon'||name==='EML2'){const e=bodyAt('Earth',jd),g=moonGeo(jd),k=name==='EML2'?1.1678:1;return e.map((c,i)=>c+g[i]*k)}
 const p=PL.find(x=>x[0]===name);if(p)return plPos(p,jd);const k=KB.find(x=>x[0]===name);if(k)return kbPos(k,jd);throw new Error('route body not modeled: '+name)}
function semiOf(name){const p=PL.find(x=>x[0]===name);if(p)return p[1][0];const k=KB.find(x=>x[0]===name);if(k)return kbEl(k).a;return 1}
function planRoute(m){const L=planLaunchJD(m[3]);if(L==null)return null;const dest=m[4],a=dest==='SEL2'||dest==='SEL1'?null:semiOf(dest),T=a==null?30:0.5*Math.pow((1+a)/2,1.5)*365.25,arr=/arrival (\w+) (\d{4})/i.exec(m[5]);
 return{L,arrive:[dest,arr?dateJD(arr[2]+'-'+String(MONTHS[arr[1].toLowerCase()]||1).padStart(2,'0')+'-01'):L+T],planned:true}}
// Build an anchor list [{t0,t1,fn}] for one object. modeled(jd) = the object's present-day model (orbit elements, state vector or host orbit).
function routeAnchors(r,modeled,hostKey){const A=[],L=r.L!=null?r.L:dateJD(r.l);A.push({t0:L,t1:L,fn:j=>bodyAt('Earth',j),tag:'launch from Earth'});
 (r.w||[]).forEach(([b,d])=>A.push({t0:dateJD(d),t1:dateJD(d),fn:j=>bodyAt(b,j),tag:'flyby '+b}));
 if(r.m){const t0=dateJD(r.m[0]),t1=r.m[1]?dateJD(r.m[1]):(r.f||r.arrive?null:Infinity);A.push({t0,t1:t1==null?t0:t1,fn:modeled,tag:'modeled orbit'})}
 (r.f||[]).forEach(([b,d])=>A.push({t0:dateJD(d),t1:dateJD(d),fn:j=>bodyAt(b,j),tag:'flyby '+b}));
 if(r.arrive){const t=typeof r.arrive[1]==='number'?r.arrive[1]:dateJD(r.arrive[1]);A.push({t0:t,t1:Infinity,fn:hostKey?modeled:(j=>bodyAt(r.arrive[0],j)),tag:'at '+r.arrive[0]})}
 else if(r.kind==='escape')A.push({t0:A[A.length-1].t0+2*365.25,t1:Infinity,fn:modeled,tag:'escape path'});
 else if(!r.m&&!r.w)A[0]={t0:L,t1:Infinity,fn:modeled,tag:'in orbit'};
 return A}
function arc(p,q,f){const r1=Math.hypot(p[0],p[1]),r2=Math.hypot(q[0],q[1]),a1=Math.atan2(p[1],p[0]);let da=Math.atan2(q[1],q[0])-a1;while(da<0)da+=2*Math.PI;if(r1<0.3&&r2<0.3||da>1.9*Math.PI)da=0;
 const r=r1+(r2-r1)*f,a=a1+da*f;if(r1<1e-9&&r2<1e-9)return[p[0]+(q[0]-p[0])*f,p[1]+(q[1]-p[1])*f,p[2]+(q[2]-p[2])*f];return[r*Math.cos(a),r*Math.sin(a),p[2]+(q[2]-p[2])*f]}
function routePos(A,jd){if(jd<A[0].t0)return null;for(let i=0;i<A.length;i++){const a=A[i];if(jd>=a.t0&&jd<=a.t1)return a.fn(jd);const n=A[i+1];if(n&&jd>a.t1&&jd<n.t0){const p=a.fn(a.t1),q=n.fn(n.t0),f=(jd-a.t1)/(n.t0-a.t1);return arc(p,q,f)}}const z=A[A.length-1];return z.fn(jd)}
function routePhase(A,jd){if(jd<A[0].t0)return'not launched yet';for(let i=0;i<A.length;i++){const a=A[i],n=A[i+1];if(jd>=a.t0&&jd<=a.t1)return a.tag;if(n&&jd>a.t1&&jd<n.t0)return'cruise to '+n.tag.replace(/^(flyby |at )/,'')}return A[A.length-1].tag}
// Evals: hidden before launch, at Earth at launch, at each flyby body on its date, monotonic outward for escape craft.
function routeEvals(){const R=[],add=(name,pass,detail)=>R.push({name,pass:!!pass,detail});let n=0,bad=[];Object.keys(ROUTES).forEach(k=>{const r=ROUTES[k],A=routeAnchors(Object.assign({},r),j=>bodyAt('Earth',j));n++;const L=dateJD(r.l);
  if(routePos(A,L-1)!==null)bad.push(k+' before launch');const e=routePos(A,L),E=bodyAt('Earth',L);if(Math.hypot(e[0]-E[0],e[1]-E[1],e[2]-E[2])>1e-9&&A[0].t1!==Infinity)bad.push(k+' launch not at Earth');
  (r.w||[]).concat(r.f||[]).forEach(([b,d])=>{const p=routePos(A,dateJD(d)),q=bodyAt(b,dateJD(d));if(Math.hypot(p[0]-q[0],p[1]-q[1],p[2]-q[2])>1e-9)bad.push(k+' misses '+b)})});
 add('Every human-made object is hidden before its launch, leaves from Earth, and meets each flyby body on its date',bad.length===0,n+' routes checked'+(bad.length?'; problems: '+bad.join(', '):''));
 {const v=VEC.find(x=>x[0]==='Voyager 1'),A=routeAnchors(ROUTES['Voyager 1'],j=>vecPos(v,j)),rs=[1978,1985,2000,2026,2100].map(y=>Math.hypot(...routePos(A,dateJD(y+'-01-01'))));add('Voyager 1 moves away from Earth and the Sun after its last flyby (forward) and back toward them (reverse)',rs.every((r,i)=>!i||r>rs[i-1]),rs.map(r=>r.toFixed(1)).join(' -> ')+' AU at 1978, 1985, 2000, 2026, 2100')}
 {const m=PLANNED.map(p=>[p[0],planRoute(p)]),bad2=m.filter(([n,r])=>!r||routePos(routeAnchors(r,j=>bodyAt('Earth',j)),r.L-1)!==null);add('Planned missions stay hidden until their planned launch',bad2.length===0,m.map(([n,r])=>n+' '+(r?new Date((r.L-2440587.5)*864e5).toISOString().slice(0,7):'?')).join(', '))}
 return R}
if(typeof module!=='undefined')Object.assign(module.exports,{ROUTES,ROUTE_NOTE,dateJD,planLaunchJD,planRoute,bodyAt,routeAnchors,routePos,routePhase,routeEvals});
