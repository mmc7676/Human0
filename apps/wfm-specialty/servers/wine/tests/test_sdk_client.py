#!/usr/bin/env python3
"""Protocol-compliance test using the official MCP Python SDK client (pip install mcp).
Run: python3 tests/test_sdk_client.py"""
import asyncio
import json
import os
import sys

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


async def main():
    params = StdioServerParameters(command=sys.executable,
                                   args=[os.path.join(ROOT, "server", "wine_mcp_server.py")])
    async with stdio_client(params) as (r, w):
        async with ClientSession(r, w) as s:
            await s.initialize()
            tools = await s.list_tools()
            names = sorted(t.name for t in tools.tools)
            print("tools:", names)
            res = await s.call_tool("wines_by_pairing", {"food": "salmon", "limit": 3})
            body = json.loads(res.content[0].text)
            print("salmon matches:", body["total_matches"])
            for row in body["results"]:
                print(" -", row["brand"], "|", row["product_name"], "|", row["price"])
            res = await s.call_tool("dataset_stats", {})
            print("stats:", json.loads(res.content[0].text)["records"], "records")
            res = await s.call_tool("get_winery", {"slug": "daou"})
            prof = json.loads(res.content[0].text)["profile"]
            print("winery:", prof["name"], prof["region"], prof["avg_rating"])
            assert prof["name"] == "DAOU"
            assert names == ["dataset_stats", "get_vivino", "get_wine", "get_winery", "list_wineries", "list_wines",
                             "search_wines", "winery_stats", "wines_by_pairing", "wines_by_winery"]
    print("SDK CLIENT TEST PASSED")


asyncio.run(main())
