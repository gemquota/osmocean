import test from "node:test";
import assert from "node:assert/strict";
import { quatFromAxisAngle, rotateVector3, multiplyQuat, normalizeQuat } from "../src/core/quaternion.js";

const near = (a, b, e = 1e-10) => assert.ok(Math.abs(a-b) <= e, `${a} != ${b}`);

test("positive 90-degree rotation about world-up +Y maps +X to -Z", () => {
  const q = quatFromAxisAngle({x:0,y:1,z:0}, Math.PI/2);
  const v = rotateVector3(q, {x:1,y:0,z:0});
  near(v.x, 0); near(v.y, 0); near(v.z, -1);
});

test("quaternion scaling does not change represented rotation", () => {
  const q = quatFromAxisAngle({x:0,y:0,z:2}, Math.PI/3);
  const scaled = {x:q.x*4,y:q.y*4,z:q.z*4,w:q.w*4};
  const v = {x:1,y:2,z:3};
  const a = rotateVector3(q,v), b = rotateVector3(scaled,v);
  near(a.x,b.x); near(a.y,b.y); near(a.z,b.z);
});

test("multiplication is associative within floating-point tolerance", () => {
  const a = quatFromAxisAngle({x:1,y:0,z:0}, .3);
  const b = quatFromAxisAngle({x:0,y:1,z:0}, .7);
  const c = quatFromAxisAngle({x:0,y:0,z:1}, -.2);
  const left = multiplyQuat(multiplyQuat(a,b),c);
  const right = multiplyQuat(a,multiplyQuat(b,c));
  near(left.x,right.x); near(left.y,right.y); near(left.z,right.z); near(left.w,right.w);
});

test("zero axis and zero quaternion are rejected", () => {
  assert.throws(() => quatFromAxisAngle({x:0,y:0,z:0},1), RangeError);
  assert.throws(() => normalizeQuat({x:0,y:0,z:0,w:0}), RangeError);
});
