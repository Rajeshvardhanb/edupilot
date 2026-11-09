import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { normalizeProfilePhoto } from "@/lib/profile-image";
import { canManagePhoto, canViewPhoto, type PhotoTarget } from "@/lib/photo-policy";
import type { Role } from "@prisma/client";
const student:PhotoTarget={id:"child-user",role:"STUDENT",student:{id:"child",batch:{program:{departmentId:"cse"}}}};
const staff:PhotoTarget={id:"teacher",role:"FACULTY",student:null};
const user=(role:Role,id="actor",departmentId:string|null="cse")=>({role,id,departmentId,children:[{id:"child",name:"Linked child",rollNo:"TEST"}]});
describe("profile photo ownership",()=>{
 it.each<Role>(["ADMIN","HOD","FACULTY","STUDENT","PARENT","OFFICE","ACCOUNTANT"])("allows %s to manage their own photo",role=>expect(canManagePhoto(user(role,"child-user"),student)).toBe(true));
 it("allows Admin/Office to manage student photos and limits Office staff targets",()=>{expect(canManagePhoto(user("ADMIN"),student)).toBe(true);expect(canManagePhoto(user("OFFICE"),student)).toBe(true);expect(canManagePhoto(user("OFFICE"),staff)).toBe(false);});
 it.each<Role>(["HOD","FACULTY","STUDENT","PARENT","ACCOUNTANT"])("does not let %s change another user's photo",role=>expect(canManagePhoto(user(role),student)).toBe(false));
 it("uses department and parent links for viewing, never blanket signed-in access",()=>{
  expect(canViewPhoto(user("HOD"),student)).toBe(true);expect(canViewPhoto(user("FACULTY","actor","ece"),student)).toBe(false);expect(canViewPhoto(user("HOD","actor",null),student)).toBe(false);
  expect(canViewPhoto(user("PARENT"),student)).toBe(true);expect(canViewPhoto({...user("PARENT"),children:[]},student)).toBe(false);expect(canViewPhoto(user("STUDENT"),student)).toBe(false);expect(canViewPhoto(user("FACULTY"),staff)).toBe(false);
 });
});
describe("profile image validation",()=>{
 it.each(["png","jpeg","webp"] as const)("decodes and normalizes %s, limits dimensions and strips metadata",async format=>{
  const input=await sharp({create:{width:1024,height:768,channels:3,background:{r:180,g:100,b:220}}}).withMetadata({exif:{IFD0:{Artist:"Private data"}}}).toFormat(format).toBuffer();
  const result=await normalizeProfilePhoto(input),meta=await sharp(result).metadata();expect(meta.format).toBe("webp");expect(meta.width).toBe(512);expect(meta.height).toBe(384);expect(meta.exif).toBeUndefined();
 });
 it("rejects fake image extensions/signatures, SVG and oversized uploads",async()=>{
  for(const bytes of [new Uint8Array(),Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'),Buffer.from('not an image'),Buffer.from([137,80,78,71,13,10,26,10]),new Uint8Array(1000001)])await expect(normalizeProfilePhoto(bytes)).rejects.toBeDefined();
 });
 it("rejects excessively large decoded dimensions",async()=>{
  const data=await sharp({create:{width:5000,height:5000,channels:3,background:"white"}}).png().toBuffer();await expect(normalizeProfilePhoto(data)).rejects.toBeDefined();
 });
});
