"use client";
import * as React from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Loader2, LockKeyhole, Mail, MapPin, Phone, Search, ShoppingBag, Store, Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CountryDisplay, countryDetails, countryFlag } from "@/components/shared/country-display";

type Item = { id:string; type:"buyer"|"seller"; name:string; company:string; headline:string; tags:string[]; country?:string; location:string; email:string; phone:string; avatar?:string; verified:boolean; purchased?:boolean };
export function ExploreMarketplace({ expected }:{ expected:"sellers"|"buyers" }) {
  const client=useQueryClient(); const [search,setSearch]=React.useState(""); const deferred=React.useDeferredValue(search.trim()); const [selected,setSelected]=React.useState<Item|null>(null); const loadMoreRef=React.useRef<HTMLDivElement|null>(null);
  const [priorityLead,setPriorityLead]=React.useState("");
  React.useEffect(()=>{if(expected==="buyers")setPriorityLead(new URLSearchParams(window.location.search).get("lead")||"");},[expected]);
  const {data,isLoading,fetchNextPage,hasNextPage,isFetchingNextPage}=useInfiniteQuery({queryKey:["member-marketplace",expected,deferred,priorityLead],initialPageParam:1,queryFn:async({pageParam})=>{const query=new URLSearchParams({page:String(pageParam),limit:"12",search:deferred});if(priorityLead)query.set("lead",priorityLead);const response=await fetch(`/api/member/marketplace?${query}`);const body=await response.json();if(!response.ok)throw new Error(body.error?.message||"Unable to load marketplace");return body.data;},getNextPageParam:last=>last.pagination.page<last.pagination.pages?last.pagination.page+1:undefined});
  const purchase = useMutation({
    mutationFn: async (item: Item) => {
      const response = await fetch("/api/member/lead-purchases/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerId: item.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Unable to create payment order");
      return body.data as { alreadyPurchased?: boolean; paymentUrl?: string; orderId?: string };
    },
    onSuccess: (result) => {
      if (result.paymentUrl && result.orderId) {
        sessionStorage.setItem("cis-lead-checkout-order", result.orderId);
        window.location.assign(result.paymentUrl);
        return;
      }
      if (!result.alreadyPurchased) {
        toast.error("Unable to open lead checkout.");
        return;
      }
      toast.success("This lead is already in Purchased Leads");
      setSelected(null);
      void client.invalidateQueries({ queryKey: ["member-marketplace"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const verificationStarted = React.useRef(false);
  React.useEffect(() => {
    if (expected !== "buyers" || verificationStarted.current) return;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const payment = {
      razorpay_order_id: params.get("razorpay_order_id"),
      razorpay_payment_id: params.get("razorpay_payment_id"),
      razorpay_signature: params.get("razorpay_signature"),
    };
    if (Object.values(payment).some((value) => !value)) return;
    if (sessionStorage.getItem("cis-lead-checkout-order") !== payment.razorpay_order_id) return;
    verificationStarted.current = true;
    const notification = toast.loading("Verifying lead payment…");

    async function verify() {
      try {
        const response = await fetch("/api/member/lead-purchases/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payment),
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error?.message || "Payment verification failed. Reload this page to retry.");
        }
        sessionStorage.removeItem("cis-lead-checkout-order");
        window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
        toast.success("Buyer lead purchased successfully", { id: notification });
        void client.invalidateQueries({ queryKey: ["member-marketplace"] });
        void client.invalidateQueries({ queryKey: ["purchased-leads"] });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Payment verification failed.", { id: notification });
      }
    }

    void verify();
  }, [client, expected]);
  React.useEffect(()=>{const target=loadMoreRef.current;if(!target)return;const observer=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting&&hasNextPage&&!isFetchingNextPage)fetchNextPage();},{rootMargin:"300px"});observer.observe(target);return()=>observer.disconnect();},[fetchNextPage,hasNextPage,isFetchingNextPage]);
  const pages=data?.pages||[]; const current=pages[0]; const items:Item[]=Array.from(new Map(pages.flatMap(result=>result.items||[]).map((item:Item)=>[item.id,item])).values()).map((item)=>({...item,tags:item.tags.map((tag)=>countryDetails(tag).name),country:""})); const Icon=expected==="sellers"?Store:Users; const price=current?.pricing?.currency==="INR"?"₹295":"$6"; const buttonPrice=current?.pricing?.currency==="INR"?"₹250 + GST":"$6";
  return <div className="space-y-5">
    <div className="flex items-end justify-between border-b pb-4"><h1 className="text-2xl font-bold">Explore {expected==="sellers"?"Sellers":"Buyers"}</h1><Badge variant="outline">{current?.pagination?.total||0} available</Badge></div>
    <div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={e=>setSearch(e.target.value)} className="pl-9" placeholder={`Search ${expected}, companies or locations...`}/></div>
    {isLoading?<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({length:6},(_,i)=><Skeleton key={i} className="h-80 rounded-xl"/>)}</div>:items.length?<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map(item=><Card key={item.id} className="overflow-hidden border-border/80"><CardHeader className="flex flex-row items-start gap-3"><Avatar className="size-11 rounded-xl"><AvatarImage src={item.avatar||""}/><AvatarFallback className="rounded-xl"><Icon className="size-5"/></AvatarFallback></Avatar><div className="min-w-0"><h2 className="flex items-center gap-1.5 truncate font-semibold">{item.name}{item.verified&&<CheckCircle2 className="size-4 text-emerald-600"/>}</h2><p className="flex items-center gap-1 truncate text-sm text-muted-foreground"><Building2 className="size-3.5"/>{item.company}</p></div></CardHeader><CardContent className="space-y-4"><p className="line-clamp-2 min-h-12 font-medium">{item.headline}</p><div className="flex min-h-7 flex-wrap gap-1">{item.tags.slice(0,3).map(tag=><Badge key={tag} variant="secondary">{countryFlag(tag)&&<span aria-hidden>{countryFlag(tag)}</span>}{tag}</Badge>)}</div><div className="space-y-2 rounded-lg bg-muted/40 p-3 text-sm"><p className="flex gap-2"><MapPin className="size-4"/>{countryFlag(item.country)&&<span aria-hidden>{countryFlag(item.country)}</span>}{item.location||"Location available after purchase"}</p><p className="flex gap-2 font-mono"><Mail className="size-4"/>{item.email}</p><p className="flex gap-2 font-mono"><Phone className="size-4"/>{item.phone}</p></div></CardContent><CardFooter><Button className={item.purchased?"w-full bg-emerald-600 text-white hover:bg-emerald-500":"w-full border border-amber-300 bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-300 font-semibold text-amber-950 shadow-sm hover:from-amber-300 hover:via-yellow-400 hover:to-amber-400"} onClick={()=>setSelected(item)}>{item.purchased?<ShoppingBag className="size-4"/>:<LockKeyhole className="size-4"/>}{item.purchased?"Purchased":`Purchase · ${buttonPrice}`}</Button></CardFooter></Card>)}</div>:<Card><CardContent className="py-16 text-center">No {expected} match your search.</CardContent></Card>}
    <div ref={loadMoreRef} className="flex min-h-12 items-center justify-center text-sm text-muted-foreground">{isFetchingNextPage?<><Loader2 className="mr-2 size-4 animate-spin"/>Loading more buyers...</>:hasNextPage?"Scroll to load more":"You have reached the end"}</div>
    <Dialog open={!!selected} onOpenChange={open=>!open&&setSelected(null)}><DialogContent><DialogHeader><DialogTitle>{selected?.purchased?"Buyer lead already purchased":"Purchase this buyer lead"}</DialogTitle><DialogDescription>{selected?.purchased?"View the full contact in Purchased Leads.":"Continue to SellersLogin checkout to unlock full contact details."}</DialogDescription></DialogHeader><div className="rounded-lg border p-4">{selected?.purchased?<p className="font-semibold text-emerald-600">Purchased</p>:<><div className="flex justify-between"><span>Buyer lead</span><span>{current?.pricing?.currency==="INR"?"₹250.00":"$6.00"}</span></div>{current?.pricing?.currency==="INR"&&<div className="mt-2 flex justify-between text-sm text-muted-foreground"><span>GST (18%)</span><span>₹45.00</span></div>}<div className="mt-3 flex justify-between border-t pt-3 font-semibold"><span>Total</span><span>{price}</span></div></>}</div><DialogFooter><Button variant="outline" onClick={()=>setSelected(null)}>Cancel</Button>{!selected?.purchased&&<Button disabled={purchase.isPending} onClick={()=>selected&&purchase.mutate(selected)}>{purchase.isPending?<Loader2 className="size-4 animate-spin"/>:<ShoppingBag className="size-4"/>}{purchase.isPending?"Preparing...":"Continue to payment"}</Button>}</DialogFooter></DialogContent></Dialog>
  </div>;
}
