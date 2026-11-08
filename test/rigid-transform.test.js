import test from "node:test";
import assert from "node:assert/strict";
import { rigidTransform, composeTransform, transformPoint, inverseTransformPoint } from "../src/core/rigid-transform.js";
import { quatFromAxisAngle } from "../src/core/quaternion.js";

const near = (a,b,e=1e-10) => assert.ok(Math.abs(a-b)<=e, `${a} != ${b}`);

test("transform and inverse recover a point", () => {
  const t = rigidTransform({position:{x:4,y:-2,z:7},rotation:quatFromAxisAngle({x:0,y:1,z:0},.8)});
  const p = {x:2,y:3,z:-1};
  const roundTrip = inverseTransformPoint(t, transformPoint(t,p));
  near(roundTrip.x,p.x); near(roundTrip.y,p.y); near(roundTrip.z,p.z);
});

test("composition applies local transform before parent transform", () => {
  const parent = rigidTransform({position:{x:10,y:0,z:0},rotation:quatFromAxisAngle({x:0,y:0,z:1},Math.PI/2)});
  const local = rigidTransform({position:{x:2,y:0,z:0}});
  const combined = composeTransform(parent,local);
  const point = transformPoint(combined,{x:0,y:0,z:0});
  near(point.x,10); near(point.y,2); near(point.z,0);
});
