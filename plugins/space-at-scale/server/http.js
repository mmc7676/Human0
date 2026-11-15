#!/usr/bin/env node
'use strict';
const express=require('express');
const crypto=require('crypto');
const {StreamableHTTPServerTransport}=require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const {buildServer}=require('./server.js');
const U=require('./universe.js');
const TOKEN=process.env.MCP_TOKEN||'';
const PORT=parseInt(process.env.PORT||'8080',10);
const app=express();
app.use(express.json({limit:'1mb'}));
const authorized=req=>{if(!TOKEN)return true;const h=req.get('authorization')||'',got=Buffer.from(h.replace(/^Bearer\s+/i,'')),want=Buffer.from(TOKEN);return got.length===want.length&&crypto.timingSafeEqual(got,want)};
app.get('/healthz',(req,res)=>res.json({ok:true,name:'scw-universe',version:'0.8.0',scws:U.nodes.size,state_version:U.sim.version,auth:TOKEN?'bearer':'none'}));
app.post('/mcp',async(req,res)=>{if(!authorized(req))return res.status(401).json({jsonrpc:'2.0',error:{code:-32001,message:'Unauthorized: send Authorization: Bearer <MCP_TOKEN>'},id:null});
 const server=buildServer(),transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined});res.on('close',()=>{transport.close();server.close()});
 try{await server.connect(transport);await transport.handleRequest(req,res,req.body)}catch(e){if(!res.headersSent)res.status(500).json({jsonrpc:'2.0',error:{code:-32603,message:'Internal error'},id:null})}});
app.all('/mcp',(req,res)=>res.status(405).set('Allow','POST').json({jsonrpc:'2.0',error:{code:-32000,message:'Method not allowed: use POST'},id:null}));
app.listen(PORT,()=>process.stderr.write('scw-universe MCP over HTTP on :'+PORT+'/mcp, auth '+(TOKEN?'bearer token':'NONE')+'\n'));
