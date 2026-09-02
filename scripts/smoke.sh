#!/usr/bin/env bash
# End-to-end smoke test against a running dev server (default http://localhost:8787).
set -euo pipefail
BASE=${BASE:-http://localhost:8787}
A=alice0000000001; B=bob000000000002
j() { curl -sf -H "x-user-id: $1" -H 'content-type: application/json' "${@:2}"; }

echo "# catalogue"
j $A "$BASE/api/catalogue" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s);console.log(c.mezes.length,"mezes,",c.tagTypes.length,"facets,",c.tagTypes.reduce((n,t)=>n+t.tags.length,0),"tags");const bad=c.mezes.filter(m=>m.tagIds.length<6);if(bad.length){console.log("under-tagged:",bad.map(m=>m.id));process.exit(1)}})'

echo "# create night as alice"
CODE=$(j $A -X POST "$BASE/api/nights" -d '{"name":"Smoke test night","displayName":"Alice"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).night.code')
echo "code=$CODE"

echo "# bob cannot act before joining"
curl -s -o /dev/null -w '%{http_code}\n' -H "x-user-id: $B" -H 'content-type: application/json' -X POST "$BASE/api/nights/$CODE/options" -d '{"mezeId":"hummus"}' | grep -q 403 && echo ok-403

echo "# bob joins"
j $B -X POST "$BASE/api/nights/$CODE/join" -d '{"displayName":"Bob"}' >/dev/null

echo "# add options"
j $A -X POST "$BASE/api/nights/$CODE/options" -d '{"mezeIds":["hummus","haydari","acili-ezme","does-not-exist"]}' >/dev/null
j $B -X POST "$BASE/api/nights/$CODE/options" -d '{"mezeId":"sigara-boregi"}' >/dev/null

echo "# votes"
j $A -X PUT "$BASE/api/nights/$CODE/options/hummus/vote" -d '{"value":2}' >/dev/null
j $B -X PUT "$BASE/api/nights/$CODE/options/hummus/vote" -d '{"value":1}' >/dev/null
j $B -X PUT "$BASE/api/nights/$CODE/options/haydari/vote" -d '{"value":-1}' >/dev/null
j $B -X PUT "$BASE/api/nights/$CODE/options/haydari/vote" -d '{"value":null}' >/dev/null
curl -s -o /dev/null -w '%{http_code}\n' -H "x-user-id: $B" -H 'content-type: application/json' -X PUT "$BASE/api/nights/$CODE/options/hummus/vote" -d '{"value":5}' | grep -q 400 && echo ok-400-bad-vote

echo "# menus"
M=$(j $B -X POST "$BASE/api/nights/$CODE/menus" -d '{"name":"Bobs menu","mezeIds":["hummus","sigara-boregi","not-an-option"]}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
j $A -X PATCH "$BASE/api/nights/$CODE/menus/$M" -d '{"name":"Everyones menu","mezeIds":["haydari","hummus"]}' >/dev/null
j $A -X PUT "$BASE/api/nights/$CODE/menus/$M/vote" -d '{"value":2}' >/dev/null
curl -s -o /dev/null -w '%{http_code}\n' -H "x-user-id: $B" -H 'content-type: application/json' -X PUT "$BASE/api/nights/$CODE/chosen" -d "{\"menuId\":\"$M\"}" | grep -q 403 && echo ok-403-non-host-crown
j $A -X PUT "$BASE/api/nights/$CODE/chosen" -d "{\"menuId\":\"$M\"}" >/dev/null

echo "# custom dish + host removes a guest"
j $B -X POST "$BASE/api/nights/$CODE/custom" -d '{"name":"  Grandma'"'"'s börek  "}' | grep -q '"id":"custom-' && echo ok-custom
curl -s -o /dev/null -w '%{http_code}\n' -H "x-user-id: $B" -H 'content-type: application/json' -X POST "$BASE/api/nights/$CODE/custom" -d '{"name":"x"}' | grep -q 400 && echo ok-400-short-name
CAROL=carol0000000003
j $CAROL -X POST "$BASE/api/nights/$CODE/join" -d '{"displayName":"Carol"}' >/dev/null
j $CAROL -X PUT "$BASE/api/nights/$CODE/options/hummus/vote" -d '{"value":2}' >/dev/null
curl -s -o /dev/null -w '%{http_code}\n' -H "x-user-id: $B" -X DELETE "$BASE/api/nights/$CODE/members/$CAROL" | grep -q 403 && echo ok-403-non-host-remove
j $A -X DELETE "$BASE/api/nights/$CODE/members/$CAROL" >/dev/null
curl -s -o /dev/null -w '%{http_code}\n' -H "x-user-id: $CAROL" -H 'content-type: application/json' -X PUT "$BASE/api/nights/$CODE/options/hummus/vote" -d '{"value":1}' | grep -q 403 && echo ok-removed-cannot-vote

echo "# rename"
j $B -X PATCH "$BASE/api/nights/$CODE/me" -d '{"displayName":"Bobby"}' >/dev/null

echo "# final state"
j $B "$BASE/api/nights/$CODE" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const st=JSON.parse(s);
  const assert=(c,m)=>{if(!c){console.error("FAIL:",m);process.exit(1)}};
  assert(st.members.length===2,"2 members");
  assert(st.members.find(m=>m.displayName==="Bobby"),"rename");
  assert(st.options.length===5,"5 options (bad id ignored, custom added), got "+st.options.length);
  assert(st.customMezes.length===1 && st.customMezes[0].name.startsWith("Grandma") && !st.customMezes[0].name.endsWith(" "),"custom meze trimmed: "+JSON.stringify(st.customMezes));
  assert(st.options.find(o=>o.mezeId===st.customMezes[0].id),"custom is an option");
  const h=st.options.find(o=>o.mezeId==="hummus"); assert(h.votes.length===2 && h.votes.reduce((a,v)=>a+v.value,0)===3,"hummus score 3");
  assert(st.options.find(o=>o.mezeId==="haydari").votes.length===0,"vote cleared");
  assert(st.menus.length===1,"1 menu");
  assert(st.menus[0].name==="Everyones menu","menu renamed");
  assert(JSON.stringify(st.menus[0].mezeIds)===JSON.stringify(["haydari","hummus"]),"menu items ordered, non-option dropped: "+JSON.stringify(st.menus[0].mezeIds));
  assert(st.menus[0].votes.length===1,"menu vote");
  assert(st.night.chosenMenuId===st.menus[0].id,"chosen");
  assert(st.me.isCreator===false && st.me.isMember===true,"me flags");
  console.log("all assertions passed");
});'

echo "# removing a custom option deletes the dish"
CID=$(j $A "$BASE/api/nights/$CODE" | node -pe 'JSON.parse(require("fs").readFileSync(0)).customMezes[0].id')
j $A -X DELETE "$BASE/api/nights/$CODE/options/$CID" >/dev/null
j $A "$BASE/api/nights/$CODE" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const st=JSON.parse(s);if(st.customMezes.length!==0){console.error("FAIL custom not deleted");process.exit(1)}console.log("ok")})'

echo "# delete menu clears chosen"
j $A -X DELETE "$BASE/api/nights/$CODE/menus/$M" >/dev/null
j $A "$BASE/api/nights/$CODE" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const st=JSON.parse(s);if(st.menus.length!==0||st.night.chosenMenuId!==null){console.error("FAIL delete");process.exit(1)}console.log("ok")})'

echo "# pairing a second device"
PH=phone000000003
LINK=$(j $A -X POST "$BASE/api/me/link")
LC=$(echo "$LINK" | node -pe 'JSON.parse(require("fs").readFileSync(0)).code')
j $PH -X POST "$BASE/api/me/link/$LC/claim" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s);if(c.userId!=="'"$A"'"){console.error("FAIL wrong identity handed over");process.exit(1)}if(!c.nights.some(n=>n.code==="'"$CODE"'")){console.error("FAIL tables not handed over");process.exit(1)}console.log("ok-claim")})'
curl -s -o /dev/null -w '%{http_code}\n' -H "x-user-id: $PH" -X POST "$BASE/api/me/link/$LC/claim" | grep -q 404 && echo ok-404-code-spent
NEW=$(j $A -X POST "$BASE/api/me/link" | node -pe 'JSON.parse(require("fs").readFileSync(0)).code')
j $A -X POST "$BASE/api/me/link" >/dev/null
curl -s -o /dev/null -w '%{http_code}\n' -H "x-user-id: $PH" -X POST "$BASE/api/me/link/$NEW/claim" | grep -q 404 && echo ok-404-code-superseded

echo "# SPA fallback"
curl -sf "$BASE/n/$CODE" | grep -q '<div id="app">' && echo ok-spa
echo "SMOKE OK ($CODE)"
