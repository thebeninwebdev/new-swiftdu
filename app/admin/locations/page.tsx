'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { captureDeliveryPosition } from '@/lib/delivery-coordinates'
import { CAMPUS_LOCATION_TYPES, type CampusLocationType } from '@/lib/campus-location'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Navigation, Plus, RotateCcw, Search, X } from 'lucide-react'
type Coordinates={latitude:number;longitude:number;accuracy:number;capturedAt:string}
type GenderRestriction='male'|'female'|'any'
type Location={_id:string;name:string;type:CampusLocationType;parentLocationId?:string|null;active:boolean;coordinates:Coordinates;childCount:number;deliveryPolicy?:{taskerGenderRestriction?:GenderRestriction}}
type Mode='parent'|'exact'
const types:Record<CampusLocationType,string>={building:'Building',hostel:'Hostel',lecture_theatre:'Lecture theatre',room:'Room',entrance:'Entrance',shop:'Shop',cafeteria:'Cafeteria',pickup_point:'Pickup point',landmark:'Landmark',other:'Other'}
const blank={name:'',type:'building' as CampusLocationType,parentLocationId:'',taskerGenderRestriction:'any' as GenderRestriction}
export default function AdminLocationsPage(){
 const [locations,setLocations]=useState<Location[]>([]),[form,setForm]=useState(blank),[mode,setMode]=useState<Mode>('parent'),[coords,setCoords]=useState<Coordinates|null>(null),[editing,setEditing]=useState<Location|null>(null),[saving,setSaving]=useState(false),[capturing,setCapturing]=useState(false),[search,setSearch]=useState('')
 const load=useCallback(async()=>{try{const r=await fetch('/api/admin/locations');const d=await r.json();if(!r.ok)throw new Error(d.error);setLocations(d.locations)}catch(e){toast.error(e instanceof Error?e.message:'Unable to load locations.')}},[])
 useEffect(()=>{void load()},[load])
 const parents=useMemo(()=>locations.filter(x=>!x.parentLocationId&&x._id!==editing?._id),[locations,editing])
 const start=(next:Mode)=>{setMode(next);setEditing(null);setForm(next==='parent'?blank:{...blank,type:'room'});setCoords(null)}
 const cancel=()=>start('parent')
 const capture=async()=>{setCapturing(true);try{setCoords(await captureDeliveryPosition())}catch(e){toast.error(e instanceof Error?e.message:'Unable to capture location.')}finally{setCapturing(false)}}
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(saving)return;if(!coords)return toast.error('Confirm your current location before saving.');if(mode==='exact'&&!form.parentLocationId)return toast.error('Select a parent location.');setSaving(true);try{const r=await fetch(editing?`/api/admin/locations/${editing._id}`:'/api/admin/locations',{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form,parentLocationId:mode==='parent'?null:form.parentLocationId,coordinates:coords})});const d=await r.json();if(!r.ok)throw new Error(d.error);toast.success('Location saved.');cancel();await load()}catch(e){console.error('[admin locations] Failed to save location.',e);toast.error(e instanceof Error?e.message:'Unable to save location.')}finally{setSaving(false)}}
 const edit=(x:Location)=>{setEditing(x);setMode(x.parentLocationId?'exact':'parent');setForm({name:x.name,type:x.type,parentLocationId:x.parentLocationId||'',taskerGenderRestriction:x.deliveryPolicy?.taskerGenderRestriction||'any'});setCoords(x.coordinates);window.scrollTo({top:0,behavior:'smooth'})}
 const toggle=async(x:Location)=>{const r=await fetch(`/api/admin/locations/${x._id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:!x.active})});const d=await r.json();if(!r.ok)return toast.error(d.error);await load()}
 const filtered=locations.filter(x=>x.name.toLowerCase().includes(search.toLowerCase())), parentName=(id:string)=>parents.find(x=>x._id===id)?.name
 return (
   <main className="mx-auto max-w-6xl px-4 py-6">
     <header className="mb-6">
       <p className="text-sm font-semibold text-violet-700">
         Campus operations
       </p>
       <h1 className="text-3xl font-bold">Campus Locations</h1>
     </header>
     <div className="mb-4 flex gap-3">
       <Button onClick={() => start("parent")} className="bg-violet-600">
         <Plus className="mr-2 h-4 w-4" />
         Add Parent Location
       </Button>
       <Button variant="outline" onClick={() => start("exact")}>
         <Plus className="mr-2 h-4 w-4" />
         Add Exact Location
       </Button>
     </div>
     <form
       onSubmit={save}
       className="rounded-3xl border bg-white p-5 shadow-sm"
     >
       <div className="mb-5 flex justify-between">
         <div>
           <h2 className="font-bold">
             {editing
               ? "Edit"
               : `Add ${mode === "parent" ? "Parent" : "Exact"} Location`}
           </h2>
           <p className="text-sm text-slate-500">
             {mode === "parent"
               ? "This GPS point is used for delivery pricing."
               : "This GPS point is the tasker’s precise destination."}
           </p>
         </div>
         {editing && (
           <Button type="button" variant="ghost" onClick={cancel}>
             <X className="mr-2 h-4 w-4" />
             Cancel
           </Button>
         )}
       </div>
       <div className="grid gap-4 sm:grid-cols-2">
         {mode === "exact" && (
           <label className="text-sm font-semibold">
             Parent Location *
             <select
               required
               value={form.parentLocationId}
               onChange={(e) =>
                 setForm({ ...form, parentLocationId: e.target.value })
               }
               className="mt-1 h-11 w-full rounded-xl border px-3"
             >
               <option value="">Select an added parent location</option>
               {parents
                 .filter((x) => x.active)
                 .map((x) => (
                   <option key={x._id} value={x._id}>
                     {x.name}
                   </option>
                 ))}
             </select>
           </label>
         )}
         <label className="text-sm font-semibold">
           {mode === "parent" ? "Parent Location" : "Exact Location Name"} *
           <Input
             required
             value={form.name}
             onChange={(e) => setForm({ ...form, name: e.target.value })}
             placeholder={mode === "parent" ? "College of Computing" : "LT1"}
             className="mt-1"
           />
         </label>
         <label className="text-sm font-semibold">
           Location Type *
           <select
             value={form.type}
             onChange={(e) =>
               setForm({ ...form, type: e.target.value as CampusLocationType })
             }
             className="mt-1 h-11 w-full rounded-xl border px-3"
           >
             {CAMPUS_LOCATION_TYPES.map((x) => (
               <option key={x} value={x}>
                 {types[x]}
               </option>
             ))}
           </select>
         </label>
         {mode === "parent" && (
           <label className="text-sm font-semibold">
             Delivery access *
             <select
               value={form.taskerGenderRestriction}
               onChange={(e) => setForm({ ...form, taskerGenderRestriction: e.target.value as GenderRestriction })}
               className="mt-1 h-11 w-full rounded-xl border px-3"
             >
               <option value="any">Everyone</option>
               <option value="male">Boys only</option>
               <option value="female">Girls only</option>
             </select>
             <span className="mt-1 block text-xs font-normal text-slate-500">Only matching taskers can accept orders to this parent location.</span>
           </label>
         )}
       </div>
       {mode === "exact" && form.parentLocationId && (
         <p className="mt-3 rounded-xl bg-violet-50 p-3 text-sm text-violet-800">
           {parentName(form.parentLocationId)} →{" "}
           {form.name || "New exact location"}
         </p>
       )}
       <div className="mt-5 rounded-2xl bg-violet-50 p-4">
         <Button
           type="button"
           onClick={capture}
           disabled={capturing}
           className="bg-violet-600"
         >
           {coords ? (
             <>
               <RotateCcw className="mr-2 h-4 w-4" />
               Retake Location
             </>
           ) : (
             <>
               <Navigation className="mr-2 h-4 w-4" />
               Confirm Current Location
             </>
           )}
         </Button>
         {coords && (
           <span className="ml-3 text-sm">
             GPS captured, ±{Math.round(coords.accuracy)}m
           </span>
         )}
       </div>
       <Button type="submit" className="mt-5 bg-violet-600" disabled={saving || !coords}>
         <Plus className="mr-2 h-4 w-4" />
         {saving ? "Saving…" : "Save Location"}
       </Button>
     </form>
     <section className="mt-8">
       <div className="mb-4 flex justify-between">
         <h2 className="text-xl font-bold">Mapped locations</h2>
         <div className="relative">
           <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
           <Input
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             className="pl-9"
             placeholder="Search locations"
           />
         </div>
       </div>
       <div className="space-y-3">
         {filtered
           .filter((x) => !x.parentLocationId)
           .map((parent) => (
             <article
               key={parent._id}
               className="rounded-2xl border bg-white p-4"
             >
               <div className="flex justify-between">
                 <div>
                   <h3 className="font-bold">{parent.name}</h3>
                   <p className="text-sm text-slate-500">
                     Parent Location · {types[parent.type]} · Pricing GPS ±
                     {Math.round(parent.coordinates.accuracy)}m ·{" "}
                     {parent.childCount} exact locations
                   </p>
                 </div>
                 <div className="flex gap-2">
                   <Button
                     size="sm"
                     variant="outline"
                     onClick={() => edit(parent)}
                   >
                     Edit
                   </Button>
                   <Button
                     size="sm"
                     variant="outline"
                     onClick={() => void toggle(parent)}
                   >
                     {parent.active ? "Deactivate" : "Reactivate"}
                   </Button>
                 </div>
               </div>
               <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2">
                 {filtered
                   .filter((x) => x.parentLocationId === parent._id)
                   .map((child) => (
                     <button
                       key={child._id}
                       onClick={() => edit(child)}
                       className="rounded-xl bg-slate-50 p-3 text-left text-sm"
                     >
                       <b>{child.name}</b>{" "}
                       <span className="text-slate-500">
                         {types[child.type]} · GPS ±
                         {Math.round(child.coordinates.accuracy)}m
                       </span>
                     </button>
                   ))}
               </div>
             </article>
           ))}
       </div>
     </section>
   </main>
 );
}
