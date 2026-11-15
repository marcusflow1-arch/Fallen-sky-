import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {getShopState,purchaseItem,sellItem,consumeItem,subscribeShop}
  from '../shop/shopStore';
import {SUIGEN_MERCHANT_CATALOG} from './SuigenTownPlan.mjs';

export const SUIGEN_MERCHANT_EVENT='game3dSuigenMerchantOpen';
export const SUIGEN_TOWN_ITEMS=Object.freeze([
  Object.freeze({id:'suigen_healing_pill',name:'Jade Healing Pill',
    icon:'🟢',price:45,description:'Restore 65 HP',effect:{kind:'heal',amount:65},
    categories:['apothecary','general']}),
  Object.freeze({id:'suigen_greater_healing_pill',name:'Greater Healing Pill',
    icon:'❤️',price:130,description:'Restore 210 HP',effect:{kind:'heal',amount:210},
    categories:['apothecary']}),
  Object.freeze({id:'suigen_lotus_recovery',name:'Lotus Recovery Pill',
    icon:'🌸',price:260,description:'Restore 450 HP',effect:{kind:'heal',amount:450},
    categories:['apothecary']}),
  Object.freeze({id:'suigen_focus_incense',name:'Focused Spirit Tonic',
    icon:'✨',price:85,description:'Next 6 hits deal +15% damage',
    effect:{kind:'damage_buff',stacks:6,multPerStack:1.15},
    categories:['apothecary','general','tavern']}),
  Object.freeze({id:'suigen_katana_oil',name:'Edge-Honing Oil',
    icon:'⚔️',price:115,description:'Next 5 hits gain +10% critical chance',
    effect:{kind:'crit_buff',stacks:5,critPctPerStack:10},
    categories:['weapons','blacksmith','materials']}),
  Object.freeze({id:'suigen_trail_ration',name:'Mountain Trail Ration',
    icon:'🍱',price:24,description:'Restore 30 HP',effect:{kind:'heal',amount:30},
    categories:['general','inn','tavern']}),
]);
const style={
  shade:{position:'fixed',inset:0,zIndex:1200,background:'rgba(2,9,15,.73)',
    display:'grid',placeItems:'center',padding:'24px',backdropFilter:'blur(9px)'},
  panel:{width:'min(680px,96vw)',maxHeight:'min(760px,90vh)',overflow:'auto',
    background:'linear-gradient(140deg,rgba(21,38,48,.98),rgba(12,24,34,.98))',
    border:'1px solid rgba(204,177,118,.53)',borderRadius:13,
    color:'#f4e6cb',fontFamily:'Georgia,serif',boxShadow:'0 20px 65px #050810c7',
    padding:'23px'},
  button:{background:'rgba(178,147,91,.2)',border:'1px solid rgba(220,195,147,.65)',
    borderRadius:6,color:'#fff1d3',padding:'8px 12px',cursor:'pointer'},
  row:{display:'flex',gap:12,alignItems:'center',justifyContent:'space-between',
    borderBottom:'1px solid rgba(229,209,165,.14)',padding:'11px 0'},
};
export default function SuigenTownMerchants(){
  const [merchant,setMerchant]=useState(null);
  const [shop,setShop]=useState(getShopState);
  const [status,setStatus]=useState('');
  const ref=useRef(null);
  useEffect(()=>subscribeShop(setShop),[]);
  useEffect(()=>{
    const open=event=>{
      const found=SUIGEN_MERCHANT_CATALOG.find(m=>m.id===event.detail?.merchantId);
      if(!found)return;
      setMerchant(found);setStatus('');window.__axeUiModalOpen=true;
    };
    window.addEventListener(SUIGEN_MERCHANT_EVENT,open);
    return ()=>{
      window.removeEventListener(SUIGEN_MERCHANT_EVENT,open);
      // An open shop must not leave the entire game input-locked after
      // world teardown or a character switch.
      window.__axeUiModalOpen=false;
    };
  },[]);
  const close=()=>{
    setMerchant(null);setStatus('');
    window.__axeUiModalOpen=false;
  };
  useEffect(()=>{
    if(!merchant)return;
    ref.current?.focus();
    const handler=e=>{
      if(e.key==='Escape'){e.stopImmediatePropagation?.();e.preventDefault();close();}
    };
    window.addEventListener('keydown',handler,true);
    return ()=>window.removeEventListener('keydown',handler,true);
  },[merchant]);
  if(!merchant)return null;
  const goods=SUIGEN_TOWN_ITEMS.filter(i=>i.categories.includes(merchant.kind));
  const owned=SUIGEN_TOWN_ITEMS.filter(item=>(shop.inventory[item.id]||0)>0);
  const action=(item,type)=>{
    const result=type==='buy'?purchaseItem(item):type==='sell'?sellItem(item):consumeItem(item);
    setStatus(result?.ok?(type==='buy'?item.name+' added to your inventory':
      type==='sell'?item.name+' sold for '+result.goldReceived+' Silver':item.name+' used')
      :result?.reason||'Transaction not completed');
  };
  const menu=(
    <div style={style.shade} onMouseDown={close}>
      <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true"
        aria-label={merchant.name} style={style.panel}
        onMouseDown={e=>e.stopPropagation()}>
        <header style={{display:'flex',alignItems:'center',gap:15,justifyContent:'space-between'}}>
          <div>
            <div style={{fontSize:11,letterSpacing:2,color:'#d2b584'}}>DOMINION OF SUIGEN · TOWN MARKET</div>
            <h2 style={{fontSize:24,margin:'6px 0'}}>{merchant.name}</h2>
            <div style={{fontSize:13,opacity:.78}}>Silver: {Math.floor(shop.gold).toLocaleString()}</div>
          </div>
          <button type="button" style={style.button} onClick={close} aria-label="Close town shop">Close ×</button>
        </header>
        {merchant.kind==='weapons'&&<p style={{color:'#efdcbb',fontSize:13}}>
          Weapons and equipped armor are managed by the existing character inventory
          and blacksmith. Selling equipped or bound equipment is unavailable here
          until its authoritative transfer checks are connected. Edge-Honing Oil is available below.
        </p>}
        {merchant.service&&<button type="button" style={{...style.button,margin:'15px 0'}}
          onClick={()=>{
            const service=merchant.service;close();
            window.dispatchEvent(new CustomEvent('axeServiceRequested',{detail:{service}}));
          }}>Open {merchant.kind==='blacksmith'?'Blacksmith':merchant.kind==='spiritual'?'Spirituality':
            merchant.kind==='guild'?'Questbook':merchant.kind==='stables'?'Companion & Mounts':'Character Service'}</button>}
        {goods.length>0&&<h3 style={{margin:'18px 0 2px',fontSize:16}}>Available supplies</h3>}
        {goods.map(item=><div style={style.row} key={item.id}>
          <span style={{fontSize:24}}>{item.icon}</span>
          <div style={{flex:1}}><strong>{item.name}</strong><div style={{fontSize:12,opacity:.68}}>{item.description}</div></div>
          <div style={{fontSize:12,minWidth:76}}>{item.price} Silver</div>
          <button style={style.button} type="button" onClick={()=>action(item,'buy')}>Buy</button>
        </div>)}
        <h3 style={{margin:'22px 0 2px',fontSize:16}}>Your tradable supplies</h3>
        {owned.length===0&&<p style={{opacity:.65,fontSize:13}}>No purchased consumables to sell or use.</p>}
        {owned.map(item=><div style={style.row} key={'owned-'+item.id}>
          <span style={{fontSize:20}}>{item.icon}</span>
          <div style={{flex:1}}><strong>{item.name}</strong>
            <div style={{fontSize:12,opacity:.7}}>Owned: {shop.inventory[item.id]}</div></div>
          <button style={style.button} type="button" onClick={()=>action(item,'sell')}>Sell</button>
          <button style={style.button} type="button" onClick={()=>action(item,'use')}>Use</button>
        </div>)}
        {status&&<p role="status" style={{marginTop:14,color:'#d4efa6'}}>{status}</p>}
        <p style={{fontSize:11,opacity:.65,marginTop:16}}>
          Consumables use the existing character-scoped Silver inventory and real
          healing/buff effects. This town vendor does not charge real money.
        </p>
      </section>
    </div>
  );
  return typeof document==='undefined'?null:createPortal(menu,document.body);
}
