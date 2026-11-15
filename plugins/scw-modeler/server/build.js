'use strict';
// Rebuild app-html.js (app.html + Human0 logo) and the single-file server bundle.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const logo=fs.readFileSync(path.join(__dirname,'..','docs','human0-logo.png')).toString('base64');
const html=fs.readFileSync(path.join(__dirname,'app.html'),'utf8').replace('__LOGO__',logo);
fs.writeFileSync(path.join(__dirname,'app-html.js'),'module.exports='+JSON.stringify(html)+';\n');
require('esbuild').buildSync({entryPoints:[path.join(__dirname,'server.js')],bundle:true,platform:'node',target:'node18',outfile:path.join(__dirname,'server.bundle.js'),legalComments:'none'});
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,f))).digest('hex');
console.log('built app-html.js',html.length,'chars; server.bundle.js',fs.statSync(path.join(__dirname,'server.bundle.js')).size,'bytes',sha('server.bundle.js').slice(0,16));
