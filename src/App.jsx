import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Printer, Save, FileText, History, Trash2, Plus, X, Search, ChevronDown, CheckCircle2, Settings, Upload, Image as ImageIcon, Lock } from 'lucide-react';

// --- Supabase Initialization ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Helper Functions ---
const getHours = (start, end) => {
  if (!start || !end) return 0;
  const [sH, sM] = start.split(':').map(Number);
  const [eH, eM] = end.split(':').map(Number);
  let totalMins = (eH * 60 + eM) - (sH * 60 + sM);
  if (totalMins < 0) totalMins += 24 * 60; 
  return parseFloat((totalMins / 60).toFixed(2));
};

const formatTime12Hour = (time24h) => {
  if (!time24h) return '-';
  const [hoursStr, minutes] = time24h.split(':');
  let hours = parseInt(hoursStr, 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  return `${hours}:${minutes} ${ampm}`;
};

const getWeekDates = (fridayDateStr) => {
  if (!fridayDateStr) return Array(7).fill('');
  const friday = new Date(fridayDateStr);
  const fridayLocal = new Date(friday.getTime() + friday.getTimezoneOffset() * 60000);
  const dates = [];
  for (let i = -4; i <= 2; i++) {
    const d = new Date(fridayLocal);
    d.setDate(d.getDate() + i);
    dates.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }
  return dates;
};

const defaultSettings = {
  companyLogo: 'logo.png',
  employeeName: 'Charles Willis',
  phone: '(706)844-8059',
  email: 'charles@naileditpropertysolutions.com',
  website: 'www.NailedItPropertySolutions.com',
  locations: {
    'Charlie': ["1056 Barker Rd.", "119 E. Main St.", "3 N. Blanche Ave", "2 N. Blanche Ave."],
    'Mike & Lee': ["7146 Blacks Bluff Rd", "385 Woods Rd", "1206 N. 5th. Ave.", "531 W. 12th. St."],
    'Terry': ["111 Nanellen Rd.", "24 Blacks Bluff Rd.", "113 Nanellen Rd."],
    'Mike Britton': ["1019 Turner Chapel Rd.",]
  }
};

const createInitialForm = () => ({
  weekEndingDate: '',
  days: [
    { name: 'Monday', date: '', location: '', assignedTo: [], startTime: '', stopTime: '', taskDetails: '', workerTasks: {}, workerLocations: {}, workerStartTimes: {}, workerStopTimes: {}, workerHours: {}, hours: 0 },
    { name: 'Tuesday', date: '', location: '', assignedTo: [], startTime: '', stopTime: '', taskDetails: '', workerTasks: {}, workerLocations: {}, workerStartTimes: {}, workerStopTimes: {}, workerHours: {}, hours: 0 },
    { name: 'Wednesday', date: '', location: '', assignedTo: [], startTime: '', stopTime: '', taskDetails: '', workerTasks: {}, workerLocations: {}, workerStartTimes: {}, workerStopTimes: {}, workerHours: {}, hours: 0 },
    { name: 'Thursday', date: '', location: '', assignedTo: [], startTime: '', stopTime: '', taskDetails: '', workerTasks: {}, workerLocations: {}, workerStartTimes: {}, workerStopTimes: {}, workerHours: {}, hours: 0 },
    { name: 'Friday', date: '', location: '', assignedTo: [], startTime: '', stopTime: '', taskDetails: '', workerTasks: {}, workerLocations: {}, workerStartTimes: {}, workerStopTimes: {}, workerHours: {}, hours: 0 },
    { name: 'Saturday', date: '', location: '', assignedTo: [], startTime: '', stopTime: '', taskDetails: '', workerTasks: {}, workerLocations: {}, workerStartTimes: {}, workerStopTimes: {}, workerHours: {}, hours: 0 },
    { name: 'Sunday', date: '', location: '', assignedTo: [], startTime: '', stopTime: '', taskDetails: '', workerTasks: {}, workerLocations: {}, workerStartTimes: {}, workerStopTimes: {}, workerHours: {}, hours: 0 }
  ],
  rate: 20,
  deductions: [],
  bonuses: [],
  datePaid: '',
  paymentMethod: ''
});

export default function App() {
  // --- Lock Screen State ---
  const [isLocked, setIsLocked] = useState(true);
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- App State ---
  const [user, setUser] = useState(null);
  const [view, setView] = useState('form'); 
  const [summaries, setSummaries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState(createInitialForm());
  const [isSaving, setIsSaving] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [printFilter, setPrintFilter] = useState('All');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [summaryTab, setSummaryTab] = useState('Total'); // 'Total' | 'Weekdays' | 'Weekend'

  const [settings, setSettings] = useState(defaultSettings);
  const [newLocs, setNewLocs] = useState({ 'Charlie': '', 'Mike & Lee': '', 'Terry': '', 'Mike Britton': '' });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // --- Authentication & Data Fetching ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (data?.user) setUser(data.user);
          if (error) console.error("Auth error. Make sure Anonymous Sign-in is enabled in Supabase.", error);
        } else {
          setUser(session.user);
        }
      } catch (err) {
        console.warn("Supabase fetch failed (expected if using placeholders).");
      }
    };
    initAuth();

    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });
      return () => subscription.unsubscribe();
    } catch (e) {
      // Ignore placeholder errors
    }
  }, []);

  const fetchSummaries = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('weekly_summaries').select('*').eq('user_id', user.id).order('weekEndingDate', { ascending: false });
      if (data) setSummaries(data);
      if (error) console.error(error);
    } catch (e) {
      // Ignore placeholder errors
    }
  };

  const fetchSettings = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('settings').select('*').eq('user_id', user.id).single();
      if (data) setSettings({ ...defaultSettings, ...data });
    } catch (e) {
      // Ignore placeholder errors
    }
  };

  useEffect(() => {
    if (user && !isLocked) {
      fetchSummaries();
      fetchSettings();
    }
  }, [user, isLocked]);

  // --- Login Handler ---
  const handleLogin = (e) => {
    e.preventDefault();
    // Default master login credentials so the real admin can get in
    if (loginUser.toLowerCase() === 'admin' && loginPass === 'admin') {
      setIsLocked(false);
      setLoginError('');
    } else {
      setLoginError('No Access Granted. Admin Only at This Time.');
      setLoginPass(''); // Clear password on fail
    }
  };

  // --- Calculations ---
  const formTotals = useMemo(() => {
    const calcSubset = (daysSubset, periodName) => {
      let totalHours = 0;
      daysSubset.forEach(d => {
        if (Array.isArray(d.assignedTo) && d.assignedTo.length > 0) {
           d.assignedTo.forEach(w => {
              totalHours += Number((d.workerHours || {})[w]) || (d.assignedTo.length === 1 ? Number(d.hours) || 0 : 0);
           });
        } else {
           totalHours += Number(d.hours) || 0;
        }
      });
      
      const gross = totalHours * (Number(formData.rate) || 0);
      const deds = (formData.deductions || []).filter(d => (d.period || 'Weekdays') === periodName).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
      const bons = (formData.bonuses || []).filter(b => (b.period || 'Weekdays') === periodName).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
      return { hours: totalHours, gross, deds, bons, net: gross + bons - deds };
    };

    const weekdays = calcSubset(formData.days.slice(0, 5), 'Weekdays');
    const weekend = calcSubset(formData.days.slice(5, 7), 'Weekend');

    return {
      weekdays,
      weekend,
      total: {
        hours: weekdays.hours + weekend.hours,
        gross: weekdays.gross + weekend.gross,
        deds: weekdays.deds + weekend.deds,
        bons: weekdays.bons + weekend.bons,
        net: weekdays.net + weekend.net
      }
    };
  }, [formData]);

  const activeTotals = summaryTab === 'Total' ? formTotals.total : summaryTab === 'Weekdays' ? formTotals.weekdays : formTotals.weekend;

  // --- Handlers ---
  const handleDateChange = (e) => {
    const newDate = e.target.value;
    const dateStrings = getWeekDates(newDate);
    setFormData(prev => ({
      ...prev,
      weekEndingDate: newDate,
      days: prev.days.map((d, i) => ({ ...d, date: dateStrings[i] }))
    }));
  };

  const updateDay = (index, field, value) => {
    const newDays = [...formData.days];
    newDays[index][field] = value;
    // Legacy single time handler just in case
    if (field === 'startTime' || field === 'stopTime') {
       newDays[index].hours = getHours(newDays[index].startTime, newDays[index].stopTime);
    }
    setFormData({ ...formData, days: newDays });
  };

  const updateWorkerTime = (index, worker, field, value) => {
    const newDays = [...formData.days];
    const day = newDays[index];
    
    if (!day.workerStartTimes) day.workerStartTimes = {};
    if (!day.workerStopTimes) day.workerStopTimes = {};
    if (!day.workerHours) day.workerHours = {};

    if (field === 'start') {
        day.workerStartTimes[worker] = value;
    } else if (field === 'stop') {
        day.workerStopTimes[worker] = value;
    }

    const start = day.workerStartTimes[worker] || (day.assignedTo.length === 1 ? day.startTime : '');
    const stop = day.workerStopTimes[worker] || (day.assignedTo.length === 1 ? day.stopTime : '');
    
    const hrs = getHours(start, stop);
    day.workerHours[worker] = hrs;

    // Legacy sync if they are the only worker assigned
    if (day.assignedTo.length === 1) {
        if (field === 'start') day.startTime = value;
        if (field === 'stop') day.stopTime = value;
        day.hours = hrs;
    }

    setFormData({ ...formData, days: newDays });
  };

  const addFin = (type) => {
    setFormData(p => ({
      ...p,
      [type]: [...(p[type] || []), { id: Date.now(), reason: '', amount: '', assignedTo: 'All', period: 'Weekdays' }]
    }));
  };

  const updateFin = (type, index, field, value) => {
    const newList = [...formData[type]];
    newList[index][field] = value;
    setFormData({ ...formData, [type]: newList });
  };

  const removeFin = (type, index) => {
    const newList = [...formData[type]];
    newList.splice(index, 1);
    setFormData({ ...formData, [type]: newList });
  };

  const handleSave = async () => {
    if (!user) {
      alert("Unable to save: Database connection not established. Make sure to configure your Supabase keys.");
      return;
    }
    setIsSaving(true);
    try {
      const dataToSave = { 
        user_id: user.id,
        weekEndingDate: formData.weekEndingDate,
        days: formData.days,
        rate: formData.rate,
        deductions: formData.deductions,
        bonuses: formData.bonuses,
        datePaid: formData.datePaid,
        paymentMethod: formData.paymentMethod,
        updatedAt: new Date().toISOString()
      };
      
      if (formData.id) {
        await supabase.from('weekly_summaries').update(dataToSave).eq('id', formData.id);
      } else {
        const { data } = await supabase.from('weekly_summaries').insert([dataToSave]).select();
        if (data && data.length > 0) setFormData(prev => ({ ...prev, id: data[0].id }));
      }
      fetchSummaries(); // Refresh list
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => setIsSaving(false), 800);
  };

  const handleDelete = async (id) => {
    if (!user) return;
    try {
      await supabase.from('weekly_summaries').delete().eq('id', id);
      fetchSummaries(); // Refresh list
      if (formData.id === id) {
        setFormData(createInitialForm());
        setView('form');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const editSummary = (summary) => {
    setFormData({ ...createInitialForm(), ...summary });
    setView('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveSettings = async () => {
    if (!user) {
      alert("Unable to save settings: Database connection not established. Configure your Supabase keys.");
      return;
    }
    setIsSavingSettings(true);
    try {
      const settingsToSave = { user_id: user.id, ...settings };
      await supabase.from('settings').upsert(settingsToSave);
    } catch (e) {
      console.error(e);
    }
    setTimeout(() => setIsSavingSettings(false), 800);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings(prev => ({ ...prev, companyLogo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const addLocation = (person) => {
    if (!newLocs[person]?.trim()) return;
    setSettings(prev => ({
      ...prev,
      locations: {
        ...prev.locations,
        [person]: [...(prev.locations[person] || []), newLocs[person].trim()]
      }
    }));
    setNewLocs(prev => ({ ...prev, [person]: '' }));
  };

  const removeLocation = (person, index) => {
    setSettings(prev => {
      const updated = [...(prev.locations[person] || [])];
      updated.splice(index, 1);
      return {
        ...prev,
        locations: { ...prev.locations, [person]: updated }
      };
    });
  };

  const handlePrint = (filter) => {
    setPrintFilter(filter);
    setShowPrintMenu(false);
    setTimeout(() => window.print(), 150);
  };

  // --- Derived Data for History ---
  const filteredHistory = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const filtered = summaries.filter(s => {
      if ((s.weekEndingDate || '').includes(q)) return true;
      return (s.days || []).some(d => 
        (d.location && d.location.toLowerCase().includes(q)) ||
        (d.assignedTo && (Array.isArray(d.assignedTo) ? d.assignedTo.join(' ').toLowerCase() : String(d.assignedTo).toLowerCase()).includes(q)) ||
        (d.taskDetails && typeof d.taskDetails === 'string' && d.taskDetails.toLowerCase().includes(q)) ||
        (d.workerTasks && Object.values(d.workerTasks).some(task => typeof task === 'string' && task.toLowerCase().includes(q))) ||
        (d.workerLocations && Object.values(d.workerLocations).some(loc => typeof loc === 'string' && loc.toLowerCase().includes(q)))
      );
    });
    return filtered;
  }, [summaries, searchQuery]);

  // --- Render Print Reports ---
  const renderPrintPage = (title, daysSubset, periodName, isLastPage) => {
    const checkAssigned = (assigned, filter) => filter === 'All' || (Array.isArray(assigned) ? assigned.includes(filter) : assigned === filter);

    const vDays = daysSubset.filter(d => checkAssigned(d.assignedTo, printFilter));
    
    // Sum hours based on individual assigned worker calculations
    const tHours = vDays.reduce((sum, d) => {
      let dayHrs = 0;
      if (Array.isArray(d.assignedTo) && d.assignedTo.length > 0) {
          d.assignedTo.forEach(w => {
             if (printFilter === 'All' || printFilter === w) {
                dayHrs += Number((d.workerHours || {})[w]) || (d.assignedTo.length === 1 ? Number(d.hours) || 0 : 0);
             }
          });
      } else {
          dayHrs += Number(d.hours) || 0;
      }
      return sum + dayHrs;
    }, 0);

    const tGross = tHours * (Number(formData.rate) || 20);
    
    const vDeds = (formData.deductions || []).filter(d => 
       (printFilter === 'All' || d.assignedTo === 'All' || d.assignedTo === printFilter) && 
       ((d.period || 'Weekdays') === periodName)
    );
    const tDeds = vDeds.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    const vBons = (formData.bonuses || []).filter(b => 
       (printFilter === 'All' || b.assignedTo === 'All' || b.assignedTo === printFilter) && 
       ((b.period || 'Weekdays') === periodName)
    );
    const tBons = vBons.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

    const tNet = tGross + tBons - tDeds;

    // We explicitly set a height of 7.5in and width of 10.5in to strictly match US Letter Landscape with margins
    return (
      <div className={`flex flex-col w-[10.5in] h-[7.5in] mx-auto box-border ${!isLastPage ? 'page-break-after' : ''}`}>
         {/* Print Header */}
         <div className="flex items-end justify-between border-b-2 border-slate-800 pb-2 mb-3 shrink-0">
             <div className="flex items-center gap-4">
                <img src={settings.companyLogo || 'logo.png'} alt="Company Logo" className="h-14 w-auto object-contain" onError={(e) => e.target.style.display='none'} />
                <div>
                   {settings.employeeName && <h2 className="text-lg font-bold text-slate-900 leading-tight">{settings.employeeName}</h2>}
                   <div className="text-[10px] text-slate-700 flex gap-4 mt-0.5 font-medium">
                      {settings.phone && <span>{settings.phone}</span>}
                      {settings.email && <span>{settings.email}</span>}
                      {settings.website && <span>{settings.website}</span>}
                   </div>
                </div>
             </div>
             <div className="text-right">
                 <h1 className="text-xl font-black uppercase tracking-widest text-slate-900 leading-tight">Weekly Summary</h1>
                 <p className="text-sm text-slate-700">Week Ending: <strong>{formData.weekEndingDate || 'N/A'}</strong></p>
                 <div className="mt-1 flex gap-2 justify-end">
                    <span className="inline-block bg-slate-800 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">{title}</span>
                    {printFilter !== 'All' && (
                      <span className="inline-block bg-slate-100 border border-slate-300 px-2 py-0.5 rounded text-[10px] font-bold text-slate-800">Property Owner: {printFilter}</span>
                    )}
                 </div>
             </div>
         </div>

         {/* Print Table */}
         <div className="mb-2 break-inside-avoid w-full shrink-0">
           <table className="w-full border-collapse border border-slate-400 text-[10px]">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-400 text-left">
                  <th className="p-1.5 border-r border-slate-400 w-20">Day</th>
                  <th className="p-1.5 border-r border-slate-400 w-24">Assigned To</th>
                  <th className="p-1.5 border-r border-slate-400 w-40">Location</th>
                  <th className="p-1.5 border-r border-slate-400 w-16 text-center">In</th>
                  <th className="p-1.5 border-r border-slate-400 w-16 text-center">Out</th>
                  <th className="p-1.5 border-r border-slate-400 w-12 text-center">Hrs</th>
                  <th className="p-1.5">Task Details</th>
                </tr>
              </thead>
              <tbody>
                {vDays.length > 0 ? vDays.map(d => (
                  <tr key={d.name} className="border-b border-slate-300">
                     <td className="p-1.5 border-r border-slate-400 leading-tight"><strong>{d.name}</strong><br/><span className="text-[9px] text-slate-600">{d.date}</span></td>
                     <td className="p-1.5 border-r border-slate-400">
                       {Array.isArray(d.assignedTo) ? (printFilter !== 'All' ? printFilter : d.assignedTo.join(', ')) : (d.assignedTo || '-')}
                     </td>
                     <td className="p-1.5 border-r border-slate-400 truncate max-w-[180px]">
                        {Array.isArray(d.assignedTo) && d.assignedTo.length > 0 ? (
                           d.assignedTo.map(w => {
                             if (printFilter !== 'All' && w !== printFilter) return null;
                             const loc = (d.workerLocations && d.workerLocations[w]) || d.location || '-';
                             return (
                               <div key={w} className="mb-0.5 leading-tight truncate">
                                 {(d.assignedTo.length > 1 && printFilter === 'All') && <strong className="text-[9px] text-slate-600">{w}: </strong>}
                                 <span>{loc}</span>
                               </div>
                             );
                           })
                        ) : (d.location || '-')}
                     </td>
                     <td className="p-1.5 border-r border-slate-400 text-center">
                        {Array.isArray(d.assignedTo) && d.assignedTo.length > 0 ? (
                           d.assignedTo.map(w => {
                              if (printFilter !== 'All' && w !== printFilter) return null;
                              const tIn = (d.workerStartTimes && d.workerStartTimes[w]) || (d.assignedTo.length === 1 ? d.startTime : '');
                              return <div key={w} className="mb-0.5 leading-tight whitespace-nowrap">{formatTime12Hour(tIn)}</div>;
                           })
                        ) : (<div className="whitespace-nowrap">{formatTime12Hour(d.startTime)}</div>)}
                     </td>
                     <td className="p-1.5 border-r border-slate-400 text-center">
                        {Array.isArray(d.assignedTo) && d.assignedTo.length > 0 ? (
                           d.assignedTo.map(w => {
                              if (printFilter !== 'All' && w !== printFilter) return null;
                              const tOut = (d.workerStopTimes && d.workerStopTimes[w]) || (d.assignedTo.length === 1 ? d.stopTime : '');
                              return <div key={w} className="mb-0.5 leading-tight whitespace-nowrap">{formatTime12Hour(tOut)}</div>;
                           })
                        ) : (<div className="whitespace-nowrap">{formatTime12Hour(d.stopTime)}</div>)}
                     </td>
                     <td className="p-1.5 border-r border-slate-400 text-center font-bold text-slate-800">
                        {Array.isArray(d.assignedTo) && d.assignedTo.length > 0 ? (
                           d.assignedTo.map(w => {
                              if (printFilter !== 'All' && w !== printFilter) return null;
                              const hrs = (d.workerHours && d.workerHours[w]) || (d.assignedTo.length === 1 ? d.hours : 0) || '-';
                              return <div key={w} className="mb-0.5 leading-tight">{hrs}</div>;
                           })
                        ) : (d.hours > 0 ? d.hours : '-')}
                     </td>
                     <td className="p-1.5">
                        {d.taskDetails && typeof d.taskDetails === 'string' && <div className="mb-0.5">{d.taskDetails}</div>}
                        {Array.isArray(d.assignedTo) && d.assignedTo.map(w => {
                           if (printFilter !== 'All' && w !== printFilter) return null;
                           const task = d.workerTasks && d.workerTasks[w];
                           if (!task) return null;
                           return (
                              <div key={w} className="mb-0.5 leading-tight">
                                {(d.assignedTo.length > 1 && printFilter === 'All') && <strong className="text-[9px] text-slate-600">{w}: </strong>}
                                <span>{task}</span>
                              </div>
                           );
                        })}
                     </td>
                  </tr>
                )) : (
                  <tr><td colSpan="7" className="p-3 text-center text-slate-500 italic">No scheduled days for this period.</td></tr>
                )}
              </tbody>
           </table>
         </div>

         {/* Print Payment Details */}
         <div className="mt-auto pt-2 border-t-2 border-slate-800 break-inside-avoid flex justify-end shrink-0">
             <div className="w-[450px] bg-slate-50 p-4 border border-slate-300 rounded shadow-sm text-xs">
                <h3 className="font-bold text-sm mb-3 text-center border-b border-slate-300 pb-1.5 uppercase tracking-wider">{title} - Payment</h3>
                <div className="grid grid-cols-2 gap-6">
                   <div>
                      <div className="flex justify-between mb-1.5 text-slate-700"><span>Total Hours:</span><strong className="text-sm">{tHours}</strong></div>
                      <div className="flex justify-between mb-1.5 text-slate-700"><span>Rate:</span><strong>${Number(formData.rate || 20).toFixed(2)} / hr</strong></div>
                      <div className="flex justify-between mb-2 border-b border-slate-200 pb-2 text-slate-800"><span>Gross Wage:</span><strong className="text-sm">${tGross.toFixed(2)}</strong></div>
                      {(formData.datePaid || formData.paymentMethod) && (
                         <div className="mt-3 text-[10px] text-slate-600 bg-white p-2 border border-slate-200 rounded">
                            <div className="mb-0.5"><strong>PAID:</strong> {formData.datePaid || 'Pending'}</div>
                            <div><strong>METHOD:</strong> {formData.paymentMethod || '-'}</div>
                         </div>
                      )}
                   </div>
                   <div className="flex flex-col justify-between">
                      <div>
                        {vBons.length > 0 && (
                          <div className="mb-1.5">
                             <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Bonuses</span>
                             {vBons.map(b => (
                               <div key={b.id} className="flex justify-between text-slate-800 text-[10px] pl-1 mb-0.5"><span>+ {b.reason || 'Bonus'}</span><span>${Number(b.amount).toFixed(2)}</span></div>
                             ))}
                          </div>
                        )}
                        {vDeds.length > 0 && (
                          <div className="mb-2 border-b border-slate-200 pb-2">
                             <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">Deductions</span>
                             {vDeds.map(d => (
                               <div key={d.id} className="flex justify-between text-slate-800 text-[10px] pl-1 mb-0.5"><span>- {d.reason || 'Deduction'}</span><span>${Number(d.amount).toFixed(2)}</span></div>
                             ))}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-sm font-black mt-2 pt-1.5 bg-slate-200 px-2 py-1.5 rounded">
                        <span>Net Pay:</span><span>${tNet.toFixed(2)}</span>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          {/* Print Footer */}
          <div className="text-center text-[9px] text-slate-500 mt-2 font-medium">
             Powered by Cronan Technology | www.cronantech.com
          </div>
      </div>
    );
  };

  // --- Render Lock Screen ---
  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 font-sans animate-in fade-in duration-500">
         <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
            
            <img src={settings.companyLogo || "logo.png"} alt="Company Logo" className="h-32 mx-auto object-contain mb-8 drop-shadow-xl" onError={(e) => e.target.style.display='none'} />
            
            <h2 className="text-2xl font-bold text-white mb-2 flex justify-center items-center gap-2">
               <Lock size={20} className="text-blue-500"/> Secure Portal
            </h2>
            <p className="text-slate-400 text-sm mb-8">Please sign in to access work summaries.</p>

            <form onSubmit={handleLogin} className="space-y-4">
               <div>
                  <input 
                     type="text" 
                     placeholder="Username" 
                     value={loginUser} 
                     onChange={(e) => setLoginUser(e.target.value)} 
                     className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" 
                     required
                  />
               </div>
               <div>
                  <input 
                     type="password" 
                     placeholder="Password" 
                     value={loginPass} 
                     onChange={(e) => setLoginPass(e.target.value)} 
                     className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" 
                     required
                  />
               </div>
               <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition shadow-lg mt-2">
                  Sign In
               </button>
            </form>

            {loginError && (
               <div className="mt-6 p-4 bg-red-900/40 border border-red-500/50 rounded-lg animate-in shake">
                  <p className="text-red-400 text-sm font-bold uppercase tracking-wider">{loginError}</p>
               </div>
            )}
         </div>

         {/* Lock Screen Footer */}
         <div className="mt-8 text-slate-500 text-xs text-center">
            Powered by <strong>Cronan Technology</strong><br />
            <a href="https://www.cronantech.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition">www.cronantech.com</a>
         </div>
      </div>
    );
  }

  // --- Main App Render ---
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex flex-col">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-slate-200 px-6 py-3 shadow-sm flex items-center justify-between print:hidden sticky top-0 z-40">
        <div className="flex items-center space-x-4">
          <img src={settings.companyLogo || "logo.png"} alt="Company Logo" className="h-10 w-auto object-contain hidden md:block" onError={(e) => e.target.style.display='none'} />
          <h1 className="text-xl font-bold text-slate-700 tracking-tight">Work Summaries</h1>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button onClick={() => setView('form')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${view === 'form' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:text-slate-900'}`}><FileText size={16} /> Timesheet</button>
          <button onClick={() => setView('history')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${view === 'history' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:text-slate-900'}`}><History size={16} /> History</button>
          <button onClick={() => setView('settings')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${view === 'settings' ? 'bg-white shadow text-blue-700' : 'text-slate-600 hover:text-slate-900'}`}><Settings size={16} /> Settings</button>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-6 print:p-0 print:max-w-none">
        
        {/* --- FORM VIEW --- */}
        {view === 'form' && (
          <div className="space-y-6 print:hidden animate-in fade-in duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div>
                 <h2 className="text-2xl font-bold text-slate-800">{formData.id ? 'Edit Weekly Summary' : 'New Weekly Summary'}</h2>
                 <p className="text-sm text-slate-500">Record shifts, locations, tasks, and calculate pay.</p>
               </div>
               <div className="flex gap-2">
                 <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 shadow-sm transition-colors">
                   {isSaving ? <CheckCircle2 size={18}/> : <Save size={18}/>}
                   {isSaving ? 'Saved!' : 'Save Summary'}
                 </button>
                 <div className="relative">
                   <button onClick={() => setShowPrintMenu(!showPrintMenu)} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md font-medium flex items-center gap-2 shadow-sm transition-colors">
                     <Printer size={18}/> Export / Print <ChevronDown size={16} className="text-slate-400"/>
                   </button>
                   {showPrintMenu && (
                     <div className="absolute right-0 mt-1 w-56 bg-white border border-slate-200 rounded-md shadow-lg z-50 py-1">
                        <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50">Print specific worker</div>
                        <button className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition" onClick={() => handlePrint('All')}>All Team Members</button>
                        <button className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition" onClick={() => handlePrint('Charlie')}>Charlie Only</button>
                        <button className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition" onClick={() => handlePrint('Mike & Lee')}>Mike & Lee Only</button>
                        <button className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition" onClick={() => handlePrint('Terry')}>Terry Only</button>
                        <button className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 transition" onClick={() => handlerPrint('Mike Britton')}>Mike Britton Only</button>
                     </div>
                   )}
                 </div>
               </div>
            </div>

            <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="w-full md:w-auto">
                <label className="block text-sm font-bold text-slate-700 mb-1">Week Ending Date (Friday)</label>
                <input type="date" value={formData.weekEndingDate} onChange={handleDateChange} className="w-full md:w-auto bg-slate-50 border border-slate-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="w-full md:w-auto bg-slate-100 rounded-lg p-3 px-6 flex flex-col justify-center border border-slate-200">
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Total Weekly Hours</p>
                <p className="text-3xl font-black text-slate-800 tracking-tight">{formTotals.total.hours}</p>
              </div>
            </div>

            {[
              { title: "Weekdays (Mon - Fri)", startIdx: 0, endIdx: 5 },
              { title: "Weekend (Sat - Sun)", startIdx: 5, endIdx: 7 }
            ].map(group => (
              <div key={group.title} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                  <h3 className="font-bold text-slate-800">{group.title}</h3>
                </div>
                <div className="p-4">
                  <div className="hidden lg:grid grid-cols-12 gap-3 text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 px-1">
                    <div className="col-span-2">Day & Date</div>
                    <div className="col-span-2">Assigned To</div>
                    <div className="col-span-2">Location / Address</div>
                    <div className="col-span-1">Time In</div>
                    <div className="col-span-1">Time Out</div>
                    <div className="col-span-1 text-center">Hours</div>
                    <div className="col-span-3">Task Details</div>
                  </div>
                  
                  {formData.days.slice(group.startIdx, group.endIdx).map((day, idx) => {
                    const actualIndex = group.startIdx + idx;
                    return (
                      <div key={day.name} className="flex flex-col lg:grid lg:grid-cols-12 gap-3 mb-6 lg:mb-2 border-b border-slate-100 lg:border-0 pb-6 lg:pb-0 px-1">
                        <div className="col-span-2 flex items-center justify-between lg:justify-start">
                          <span className="font-bold text-slate-700 lg:hidden">{day.name}</span>
                          <div className="flex flex-col">
                             <span className="font-bold text-slate-700 hidden lg:block">{day.name}</span>
                             <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded inline-block mt-0.5">{day.date || 'Select Week'}</span>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-slate-500 mb-1 block lg:hidden">Assigned To</label>
                          <div className="flex flex-wrap gap-1">
                            {['Charlie', 'Mike & Lee', 'Terry', 'Mike Britton',].map(person => {
                               const assignedArr = Array.isArray(day.assignedTo) ? day.assignedTo : (day.assignedTo ? [day.assignedTo] : []);
                               const isSelected = assignedArr.includes(person);
                               return (
                                 <button
                                   key={person}
                                   type="button"
                                   onClick={() => {
                                     const next = isSelected ? assignedArr.filter(p => p !== person) : [...assignedArr, person];
                                     updateDay(actualIndex, 'assignedTo', next);
                                   }}
                                   className={`px-1.5 py-0.5 text-[10px] sm:text-xs rounded border transition-colors ${isSelected ? 'bg-blue-100 border-blue-400 text-blue-800 font-bold' : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'}`}
                                 >
                                   {person}
                                 </button>
                               );
                            })}
                          </div>
                        </div>
                        <div className="col-span-2 flex flex-col gap-1.5">
                          <label className="text-xs text-slate-500 mb-1 block lg:hidden">Location</label>
                          {Array.isArray(day.assignedTo) && day.assignedTo.length > 0 ? (
                            day.assignedTo.map(worker => (
                              <div key={worker} className="flex items-center gap-1 h-[36px] w-full">
                                {day.assignedTo.length > 1 && <span className="text-[10px] font-bold text-slate-500 w-14 leading-tight truncate">{worker}</span>}
                                <select 
                                  value={(day.workerLocations && day.workerLocations[worker]) || (day.assignedTo.length === 1 ? day.location : '') || ''} 
                                  onChange={(e) => {
                                    const newDays = [...formData.days];
                                    newDays[actualIndex].workerLocations = {
                                      ...(newDays[actualIndex].workerLocations || {}),
                                      [worker]: e.target.value
                                    };
                                    if (day.assignedTo.length === 1) {
                                       newDays[actualIndex].location = e.target.value;
                                    }
                                    setFormData({ ...formData, days: newDays });
                                  }} 
                                  className="flex-1 w-full border border-slate-300 bg-white rounded p-1.5 text-sm h-full"
                                >
                                  <option value="">{`-- Select Location --`}</option>
                                  {(settings.locations[worker] || []).map((loc, i) => (
                                    <option key={i} value={loc}>{loc}</option>
                                  ))}
                                </select>
                              </div>
                            ))
                          ) : (
                            <div className="flex items-center h-[36px] w-full">
                               <select disabled className="w-full border border-slate-200 bg-slate-50 text-slate-400 rounded p-1.5 text-sm h-full">
                                  <option>Select Worker First</option>
                               </select>
                            </div>
                          )}
                          {(!Array.isArray(day.assignedTo) || day.assignedTo.length === 0) && day.location && (
                             <div className="text-xs text-slate-400 truncate mt-1">Legacy: {day.location}</div>
                          )}
                        </div>
                        <div className="col-span-1 flex flex-col gap-1.5">
                          <label className="text-xs text-slate-500 mb-1 block lg:hidden">Time In</label>
                          {Array.isArray(day.assignedTo) && day.assignedTo.length > 0 ? (
                             day.assignedTo.map(worker => (
                               <div key={worker} className="flex items-center h-[36px] w-full">
                                 {day.assignedTo.length > 1 && <span className="lg:hidden text-[10px] font-bold text-slate-500 w-12 truncate mr-1">{worker}</span>}
                                 <input 
                                   type="time" 
                                   value={(day.workerStartTimes && day.workerStartTimes[worker]) || (day.assignedTo.length === 1 ? day.startTime : '') || ''} 
                                   onChange={(e) => updateWorkerTime(actualIndex, worker, 'start', e.target.value)} 
                                   className="w-full border border-slate-300 rounded p-1.5 text-sm h-full" 
                                 />
                               </div>
                             ))
                          ) : (
                             <div className="flex items-center h-[36px] w-full">
                               <input type="time" disabled className="w-full border border-slate-200 bg-slate-50 rounded p-1.5 text-sm h-full" />
                             </div>
                          )}
                        </div>
                        <div className="col-span-1 flex flex-col gap-1.5">
                          <label className="text-xs text-slate-500 mb-1 block lg:hidden">Time Out</label>
                          {Array.isArray(day.assignedTo) && day.assignedTo.length > 0 ? (
                             day.assignedTo.map(worker => (
                               <div key={worker} className="flex items-center h-[36px] w-full">
                                 {day.assignedTo.length > 1 && <span className="lg:hidden text-[10px] font-bold text-slate-500 w-12 truncate mr-1">{worker}</span>}
                                 <input 
                                   type="time" 
                                   value={(day.workerStopTimes && day.workerStopTimes[worker]) || (day.assignedTo.length === 1 ? day.stopTime : '') || ''} 
                                   onChange={(e) => updateWorkerTime(actualIndex, worker, 'stop', e.target.value)} 
                                   className="w-full border border-slate-300 rounded p-1.5 text-sm h-full" 
                                 />
                               </div>
                             ))
                          ) : (
                             <div className="flex items-center h-[36px] w-full">
                               <input type="time" disabled className="w-full border border-slate-200 bg-slate-50 rounded p-1.5 text-sm h-full" />
                             </div>
                          )}
                        </div>
                        <div className="col-span-1 flex flex-col gap-1.5">
                          <label className="text-xs text-slate-500 mb-1 block lg:hidden">Hours</label>
                          {Array.isArray(day.assignedTo) && day.assignedTo.length > 0 ? (
                             day.assignedTo.map(worker => {
                                const hrs = (day.workerHours && day.workerHours[worker]) || (day.assignedTo.length === 1 ? day.hours : 0) || '-';
                                return (
                                   <div key={worker} className="flex items-center justify-center bg-slate-50 border border-slate-200 rounded h-[36px] w-full text-sm font-bold text-slate-700">
                                     {day.assignedTo.length > 1 && <span className="lg:hidden mr-1 text-[10px] font-normal text-slate-500">{worker}:</span>}
                                     {hrs > 0 ? hrs : '-'}
                                   </div>
                                )
                             })
                          ) : (
                             <div className="flex items-center justify-center bg-slate-50 border border-slate-200 rounded h-[36px] w-full text-sm font-bold text-slate-700">
                               {day.hours > 0 ? day.hours : '-'}
                             </div>
                          )}
                        </div>
                        <div className="col-span-3 flex flex-col gap-1.5">
                           <label className="text-xs text-slate-500 mb-1 block lg:hidden">Task Details</label>
                           {typeof day.taskDetails === 'string' && day.taskDetails && (
                              <input type="text" placeholder="General task (legacy)..." value={day.taskDetails} onChange={(e) => updateDay(actualIndex, 'taskDetails', e.target.value)} className="w-full border border-slate-300 rounded p-1.5 text-sm h-[36px]" />
                           )}
                           {Array.isArray(day.assignedTo) && day.assignedTo.length > 0 ? (
                             day.assignedTo.map(worker => (
                               <div key={worker} className="flex items-center gap-1 h-[36px] w-full">
                                 {day.assignedTo.length > 1 && <span className="text-[10px] font-bold text-slate-500 w-14 leading-tight truncate">{worker}</span>}
                                 <input 
                                   type="text" 
                                   placeholder={`${worker}'s Task...`}
                                   value={(day.workerTasks && day.workerTasks[worker]) || ''} 
                                   onChange={(e) => {
                                     const newDays = [...formData.days];
                                     newDays[actualIndex].workerTasks = {
                                       ...(newDays[actualIndex].workerTasks || {}),
                                       [worker]: e.target.value
                                     };
                                     setFormData({ ...formData, days: newDays });
                                   }} 
                                   className="flex-1 border border-slate-300 rounded p-1.5 text-sm h-full" 
                                 />
                               </div>
                             ))
                           ) : (
                             <div className="flex items-center h-[36px] w-full">
                                <span className="text-xs text-slate-400 italic">Select workers to assign tasks.</span>
                             </div>
                           )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
               <div className="lg:col-span-3 space-y-4">
                  {/* Deductions */}
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 overflow-x-auto">
                    <div className="flex justify-between items-center mb-3">
                       <h4 className="font-bold text-slate-800">Deductions</h4>
                       <button onClick={() => addFin('deductions')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1 px-3 rounded flex items-center gap-1 transition"><Plus size={14}/> Add</button>
                    </div>
                    {formData.deductions.length === 0 && <p className="text-sm text-slate-400 italic">No deductions applied.</p>}
                    {formData.deductions.map((d, i) => (
                       <div key={d.id} className="flex flex-nowrap gap-2 mb-2 min-w-[500px]">
                          <input placeholder="Reason" value={d.reason} onChange={(e) => updateFin('deductions', i, 'reason', e.target.value)} className="border border-slate-300 rounded p-1.5 text-sm flex-1" />
                          <input type="number" placeholder="$0.00" value={d.amount} onChange={(e) => updateFin('deductions', i, 'amount', e.target.value)} className="border border-slate-300 rounded p-1.5 text-sm w-20" />
                          <select value={d.period || 'Weekdays'} onChange={(e) => updateFin('deductions', i, 'period', e.target.value)} className="border border-slate-300 rounded p-1.5 text-sm w-28 bg-white">
                             <option value="Weekdays">Weekdays</option>
                             <option value="Weekend">Weekend</option>
                          </select>
                          <select value={d.assignedTo} onChange={(e) => updateFin('deductions', i, 'assignedTo', e.target.value)} className="border border-slate-300 rounded p-1.5 text-sm w-28 bg-white">
                             <option value="All">All Workers</option>
                             <option value="Charlie">Charlie</option>
                             <option value="Mike & Lee">Mike & Lee</option>
                             <option value="Terry">Terry</option>
                             <option value="Mike Britton">Mike Britton</option>
                          </select>
                          <button onClick={() => removeFin('deductions', i)} className="text-slate-400 hover:text-red-500 p-1.5"><X size={18}/></button>
                       </div>
                    ))}
                  </div>

                  {/* Bonuses */}
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 overflow-x-auto">
                    <div className="flex justify-between items-center mb-3">
                       <h4 className="font-bold text-slate-800">Bonuses</h4>
                       <button onClick={() => addFin('bonuses')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1 px-3 rounded flex items-center gap-1 transition"><Plus size={14}/> Add</button>
                    </div>
                    {formData.bonuses.length === 0 && <p className="text-sm text-slate-400 italic">No bonuses applied.</p>}
                    {formData.bonuses.map((b, i) => (
                       <div key={b.id} className="flex flex-nowrap gap-2 mb-2 min-w-[500px]">
                          <input placeholder="Reason" value={b.reason} onChange={(e) => updateFin('bonuses', i, 'reason', e.target.value)} className="border border-slate-300 rounded p-1.5 text-sm flex-1" />
                          <input type="number" placeholder="$0.00" value={b.amount} onChange={(e) => updateFin('bonuses', i, 'amount', e.target.value)} className="border border-slate-300 rounded p-1.5 text-sm w-20" />
                          <select value={b.period || 'Weekdays'} onChange={(e) => updateFin('bonuses', i, 'period', e.target.value)} className="border border-slate-300 rounded p-1.5 text-sm w-28 bg-white">
                             <option value="Weekdays">Weekdays</option>
                             <option value="Weekend">Weekend</option>
                          </select>
                          <select value={b.assignedTo} onChange={(e) => updateFin('bonuses', i, 'assignedTo', e.target.value)} className="border border-slate-300 rounded p-1.5 text-sm w-28 bg-white">
                             <option value="All">All Workers</option>
                             <option value="Charlie">Charlie</option>
                             <option value="Mike & Lee">Mike & Lee</option>
                             <option value="Terry">Terry</option>
                             <option value="Mike Britton">Mike Britton</option>
                          </select>
                          <button onClick={() => removeFin('bonuses', i)} className="text-slate-400 hover:text-red-500 p-1.5"><X size={18}/></button>
                       </div>
                    ))}
                  </div>
               </div>

               {/* Dynamic Screen Summary */}
               <div className="lg:col-span-2 bg-slate-800 text-white rounded-lg shadow-md flex flex-col h-full overflow-hidden border border-slate-700">
                  <div className="flex bg-slate-900 border-b border-slate-700 text-sm font-medium">
                     <button onClick={() => setSummaryTab('Total')} className={`flex-1 py-3 text-center transition ${summaryTab === 'Total' ? 'bg-slate-800 text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'}`}>Grand Total</button>
                     <button onClick={() => setSummaryTab('Weekdays')} className={`flex-1 py-3 text-center transition ${summaryTab === 'Weekdays' ? 'bg-slate-800 text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'}`}>Weekdays</button>
                     <button onClick={() => setSummaryTab('Weekend')} className={`flex-1 py-3 text-center transition ${summaryTab === 'Weekend' ? 'bg-slate-800 text-blue-400 border-b-2 border-blue-400' : 'text-slate-400 hover:text-white'}`}>Weekend</button>
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="space-y-3 flex-1">
                      <div className="flex justify-between items-center text-slate-300">
                        <span>{summaryTab} Hours</span>
                        <span className="font-mono text-white font-bold">{activeTotals.hours}</span>
                      </div>
                      <div className="flex justify-between items-center text-slate-300">
                        <span>Hourly Rate</span>
                        <div className="flex items-center bg-slate-700 rounded overflow-hidden border border-slate-600 focus-within:border-blue-400">
                           <span className="px-2 text-slate-400 font-mono">$</span>
                           <input type="number" value={formData.rate} onChange={(e) => setFormData({...formData, rate: e.target.value})} className="bg-transparent text-white font-mono p-1 w-16 outline-none" />
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-lg mt-2 pt-2 border-t border-slate-600">
                        <span>Gross Wage</span>
                        <span className="font-mono font-bold">${activeTotals.gross.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-red-400 text-sm">
                        <span>Deductions</span>
                        <span className="font-mono">-${activeTotals.deds.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-green-400 text-sm">
                        <span>Bonuses</span>
                        <span className="font-mono">+${activeTotals.bons.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="mt-4 bg-slate-900 p-4 rounded border border-slate-700">
                       <div className="flex justify-between items-center text-xl font-bold text-white mb-4">
                         <span>Net Pay</span>
                         <span className="font-mono text-blue-400">${activeTotals.net.toFixed(2)}</span>
                       </div>
                       <div className="grid grid-cols-2 gap-3">
                          <div>
                             <label className="text-xs text-slate-400 block mb-1">Date Paid</label>
                             <input type="date" value={formData.datePaid} onChange={e => setFormData({...formData, datePaid: e.target.value})} className="bg-slate-800 border border-slate-600 rounded p-1.5 w-full text-sm text-white focus:outline-none"/>
                          </div>
                          <div>
                             <label className="text-xs text-slate-400 block mb-1">Method</label>
                             <select value={formData.paymentMethod} onChange={e => setFormData({...formData, paymentMethod: e.target.value})} className="bg-slate-800 border border-slate-600 rounded p-1.5 w-full text-sm text-white focus:outline-none appearance-none">
                                <option value="">Select...</option>
                                <option value="Check">Check</option>
                                <option value="Direct Deposit">Direct Deposit</option>
                                <option value="Cash">Cash</option>
                                <option value="CashApp">CashApp</option>
                                <option value="Zelle">Zelle</option>
                                <option value="Venmo">Venmo</option>
                             </select>
                          </div>
                       </div>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* --- HISTORY VIEW --- */}
        {view === 'history' && (
          <div className="space-y-6 print:hidden animate-in fade-in duration-300">
             <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                 <div>
                   <h2 className="text-2xl font-bold text-slate-800">Saved Summaries</h2>
                   <p className="text-sm text-slate-500">Access and edit past weekly work sheets.</p>
                 </div>
                 <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Search name, location..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md bg-slate-50 focus:bg-white outline-none"
                    />
                 </div>
               </div>

               {filteredHistory.length === 0 ? (
                 <div className="text-center py-12 text-slate-500">
                   <History size={48} className="mx-auto text-slate-300 mb-3" />
                   <p className="text-lg">No summaries found.</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                   {filteredHistory.map(summary => {
                      const totalHrs = (summary.days || []).reduce((sum, d) => sum + (Number(d.hours)||0), 0);
                      const workers = [...new Set((summary.days || []).flatMap(d => Array.isArray(d.assignedTo) ? d.assignedTo : [d.assignedTo]).filter(Boolean))];
                      return (
                        <div key={summary.id} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition bg-slate-50">
                           <div className="flex justify-between items-start mb-2">
                             <h3 className="font-bold text-lg text-slate-800">{summary.weekEndingDate || 'Undated'}</h3>
                             <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">{totalHrs} hrs</span>
                           </div>
                           <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                             <strong>Team:</strong> {workers.length > 0 ? workers.join(', ') : 'Unassigned'}
                           </p>
                           <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                             <button onClick={() => editSummary(summary)} className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded font-medium text-xs transition">Load & Edit</button>
                             {deleteConfirmId === summary.id ? (
                               <div className="flex gap-2 text-sm bg-red-50 p-1 rounded border border-red-100">
                                 <button onClick={() => handleDelete(summary.id)} className="text-red-700 font-bold px-1 hover:underline">Confirm</button>
                                 <button onClick={() => setDeleteConfirmId(null)} className="text-slate-600 px-1 hover:underline">Cancel</button>
                               </div>
                             ) : (
                               <button onClick={() => setDeleteConfirmId(summary.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={18}/></button>
                             )}
                           </div>
                        </div>
                      )
                   })}
                 </div>
               )}
             </div>
          </div>
        )}

        {/* --- SETTINGS VIEW --- */}
        {view === 'settings' && (
          <div className="space-y-6 print:hidden animate-in fade-in duration-300">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                 <div>
                   <h2 className="text-2xl font-bold text-slate-800">Application Settings</h2>
                   <p className="text-sm text-slate-500">Manage company profile and worker locations.</p>
                 </div>
                 <button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2 shadow-sm transition-colors">
                   {isSavingSettings ? <CheckCircle2 size={18}/> : <Save size={18}/>}
                   {isSavingSettings ? 'Saved!' : 'Save Settings'}
                 </button>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 h-full">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Company Profile</h3>
                    <div className="mb-4">
                       <label className="block text-sm font-bold text-slate-700 mb-2">Company Logo</label>
                       <div className="flex items-center gap-4">
                          <div className="h-16 w-32 border border-slate-200 rounded-md flex items-center justify-center bg-slate-50 overflow-hidden">
                             {settings.companyLogo ? (
                                <img src={settings.companyLogo} alt="Logo Preview" className="h-full w-full object-contain p-1" />
                             ) : (
                                <ImageIcon className="text-slate-300" size={24} />
                             )}
                          </div>
                          <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded text-sm font-medium flex items-center gap-2 transition">
                             <Upload size={16} /> Upload Image
                             <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                          </label>
                          {settings.companyLogo !== 'logo.png' && (
                             <button onClick={() => setSettings({...settings, companyLogo: 'logo.png'})} className="text-xs text-red-500 hover:underline">Reset to Default</button>
                          )}
                       </div>
                    </div>
                    <div className="space-y-3">
                       <div><label className="block text-xs font-bold text-slate-600 mb-1">Company / Employee Name</label><input type="text" value={settings.employeeName} onChange={e => setSettings({...settings, employeeName: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm" /></div>
                       <div><label className="block text-xs font-bold text-slate-600 mb-1">Phone Number</label><input type="text" value={settings.phone} onChange={e => setSettings({...settings, phone: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm" /></div>
                       <div><label className="block text-xs font-bold text-slate-600 mb-1">Email Address</label><input type="email" value={settings.email} onChange={e => setSettings({...settings, email: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm" /></div>
                       <div><label className="block text-xs font-bold text-slate-600 mb-1">Website URL</label><input type="url" value={settings.website} onChange={e => setSettings({...settings, website: e.target.value})} className="w-full border border-slate-300 rounded p-2 text-sm" /></div>
                    </div>
                 </div>

                 <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-100 pb-2">Worker Locations</h3>
                    <div className="space-y-6">
                       {['Charlie', 'Mike & Lee', 'Terry', 'Mike Britton',].map(person => (
                          <div key={person} className="bg-slate-50 p-3 rounded border border-slate-200">
                             <h4 className="font-bold text-sm text-slate-700 mb-2">{person}'s Locations</h4>
                             <div className="flex gap-2 mb-2">
                                <input type="text" value={newLocs[person]} onChange={e => setNewLocs({...newLocs, [person]: e.target.value})} onKeyDown={e => e.key === 'Enter' && addLocation(person)} placeholder="Add address..." className="flex-1 border border-slate-300 rounded p-1.5 text-sm outline-none" />
                                <button onClick={() => addLocation(person)} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 rounded text-sm font-medium">Add</button>
                             </div>
                             {(!settings.locations[person] || settings.locations[person].length === 0) ? (
                                <p className="text-xs text-slate-400 italic">No locations added yet.</p>
                             ) : (
                                <ul className="space-y-1 mt-2">
                                   {settings.locations[person].map((loc, i) => (
                                      <li key={i} className="flex justify-between items-center bg-white border border-slate-200 rounded p-1.5 text-sm">
                                         <span className="truncate pr-2">{loc}</span>
                                         <button onClick={() => removeLocation(person, i)} className="text-slate-400 hover:text-red-500 flex-shrink-0"><X size={14}/></button>
                                      </li>
                                   ))}
                                </ul>
                             )}
                          </div>
                       ))}
                    </div>
                 </div>
             </div>
          </div>
        )}
      </main>

      {/* --- SCREEN FOOTER --- */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto print:hidden">
         <div className="max-w-6xl mx-auto px-4 md:px-6 flex flex-col md:flex-row justify-between items-center gap-2 text-xs text-slate-500">
            <p>Powered by <strong>Cronan Technology</strong></p>
            <a href="https://www.cronantech.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 transition hover:underline">www.cronantech.com</a>
         </div>
      </footer>

      {/* --- PRINT VIEW --- */}
      <div className="hidden print:block w-full bg-white text-black p-0 m-0">
         <style type="text/css">
           {`
             @media print {
               @page { size: letter landscape; margin: 0.3in; }
               body { 
                 -webkit-print-color-adjust: exact; 
                 print-color-adjust: exact; 
                 margin: 0; 
                 padding: 0; 
                 box-sizing: border-box; 
               }
               * { box-sizing: border-box; }
               .page-break-after { page-break-after: always; }
             }
           `}
         </style>
         
         {/* Page 1: Weekdays Report */}
         {renderPrintPage("Weekdays Report", formData.days.slice(0, 5), "Weekdays", false)}
         
         {/* Page 2: Weekend Report */}
         {renderPrintPage("Weekend Report", formData.days.slice(5, 7), "Weekend", true)}

      </div>

    </div>
  );
}