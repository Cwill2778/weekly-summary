import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Printer, Save, FileText, History, Trash2, Plus, X, Search, ChevronDown, CheckCircle2, Settings, Upload, Image as ImageIcon } from 'lucide-react';

// --- Supabase Initialization ---
// NOTE FOR VS CODE: When copying to VS Code (Vite), uncomment the two lines below and remove the placeholder ones!
// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
// const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabaseUrl = 'https://placeholder-url.supabase.co'; 
const supabaseKey = 'placeholder-key'; 
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
  employeeName: '',
  phone: '',
  email: '',
  website: '',
  locations: {
    'Charlie': [],
    'Mike & Lee': [],
    'Terry': []
  }
};

const createInitialForm = () => ({
  weekEndingDate: '',
  days: [
    { name: 'Monday', date: '', location: '', assignedTo: '', startTime: '', stopTime: '', taskDetails: '', hours: 0 },
    { name: 'Tuesday', date: '', location: '', assignedTo: '', startTime: '', stopTime: '', taskDetails: '', hours: 0 },
    { name: 'Wednesday', date: '', location: '', assignedTo: '', startTime: '', stopTime: '', taskDetails: '', hours: 0 },
    { name: 'Thursday', date: '', location: '', assignedTo: '', startTime: '', stopTime: '', taskDetails: '', hours: 0 },
    { name: 'Friday', date: '', location: '', assignedTo: '', startTime: '', stopTime: '', taskDetails: '', hours: 0 },
    { name: 'Saturday', date: '', location: '', assignedTo: '', startTime: '', stopTime: '', taskDetails: '', hours: 0 },
    { name: 'Sunday', date: '', location: '', assignedTo: '', startTime: '', stopTime: '', taskDetails: '', hours: 0 }
  ],
  rate: 20,
  deductions: [],
  bonuses: [],
  datePaid: '',
  paymentMethod: ''
});

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('form'); 
  const [summaries, setSummaries] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState(createInitialForm());
  const [isSaving, setIsSaving] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [printFilter, setPrintFilter] = useState('All');
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const [settings, setSettings] = useState(defaultSettings);
  const [newLocs, setNewLocs] = useState({ 'Charlie': '', 'Mike & Lee': '', 'Terry': '' });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // --- Authentication & Data Fetching ---
  useEffect(() => {
    // Check active session or sign in anonymously
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
    if (user) {
      fetchSummaries();
      fetchSettings();
    }
  }, [user]);

  // --- Calculations ---
  const formTotals = useMemo(() => {
    const hours = formData.days.reduce((sum, d) => sum + (Number(d.hours) || 0), 0);
    const gross = hours * (Number(formData.rate) || 0);
    const deds = (formData.deductions || []).reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    const bons = (formData.bonuses || []).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    return { hours, gross, deds, bons, net: gross + bons - deds };
  }, [formData]);

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
    if (field === 'startTime' || field === 'stopTime') {
       newDays[index].hours = getHours(newDays[index].startTime, newDays[index].stopTime);
    }
    setFormData({ ...formData, days: newDays });
  };

  const addFin = (type) => {
    setFormData(p => ({
      ...p,
      [type]: [...(p[type] || []), { id: Date.now(), reason: '', amount: '', assignedTo: 'All' }]
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
        (d.assignedTo && d.assignedTo.toLowerCase().includes(q)) ||
        (d.taskDetails && d.taskDetails.toLowerCase().includes(q))
      );
    });
    return filtered;
  }, [summaries, searchQuery]);

  // --- Render Helpers ---
  const renderPrintTable = (title, daysSubset, filter) => {
    const visibleDays = daysSubset.filter(d => filter === 'All' || d.assignedTo === filter);
    return (
      <div className="mb-6 break-inside-avoid">
         <h2 className="font-bold text-lg mb-2 text-slate-800">{title}</h2>
         <table className="w-full border-collapse border border-slate-400 text-sm">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400 text-left">
                <th className="p-2 border-r border-slate-400 w-28">Day</th>
                <th className="p-2 border-r border-slate-400 w-28">Assigned To</th>
                <th className="p-2 border-r border-slate-400 w-48">Location</th>
                <th className="p-2 border-r border-slate-400 w-16 text-center">In</th>
                <th className="p-2 border-r border-slate-400 w-16 text-center">Out</th>
                <th className="p-2 border-r border-slate-400 w-16 text-center">Hrs</th>
                <th className="p-2">Task Details</th>
              </tr>
            </thead>
            <tbody>
              {visibleDays.length > 0 ? visibleDays.map(d => (
                <tr key={d.name} className="border-b border-slate-300">
                   <td className="p-2 border-r border-slate-400"><strong>{d.name}</strong><br/><span className="text-xs text-slate-600">{d.date}</span></td>
                   <td className="p-2 border-r border-slate-400">{d.assignedTo || '-'}</td>
                   <td className="p-2 border-r border-slate-400">{d.location || '-'}</td>
                   <td className="p-2 border-r border-slate-400 text-center">{d.startTime || '-'}</td>
                   <td className="p-2 border-r border-slate-400 text-center">{d.stopTime || '-'}</td>
                   <td className="p-2 border-r border-slate-400 text-center font-bold text-slate-800">{d.hours > 0 ? d.hours : '-'}</td>
                   <td className="p-2">{d.taskDetails || '-'}</td>
                </tr>
              )) : (
                <tr><td colSpan="7" className="p-4 text-center text-slate-500 italic">No scheduled days for this period.</td></tr>
              )}
            </tbody>
         </table>
      </div>
    );
  };

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
                <p className="text-3xl font-black text-slate-800 tracking-tight">{formTotals.hours}</p>
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
                          <select value={day.assignedTo} onChange={(e) => updateDay(actualIndex, 'assignedTo', e.target.value)} className="w-full border border-slate-300 rounded p-2 lg:p-1.5 text-sm bg-white">
                             <option value="">-- Select --</option>
                             <option value="Charlie">Charlie</option>
                             <option value="Mike & Lee">Mike & Lee</option>
                             <option value="Terry">Terry</option>
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs text-slate-500 mb-1 block lg:hidden">Location</label>
                          <select 
                             value={day.location} 
                             onChange={(e) => updateDay(actualIndex, 'location', e.target.value)} 
                             className={`w-full border ${!day.assignedTo ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-300 bg-white'} rounded p-2 lg:p-1.5 text-sm`}
                             disabled={!day.assignedTo}
                          >
                             <option value="">{day.assignedTo ? '-- Select Location --' : 'Select Worker First'}</option>
                             {(settings.locations[day.assignedTo] || []).map((loc, i) => (
                               <option key={i} value={loc}>{loc}</option>
                             ))}
                          </select>
                        </div>
                        <div className="col-span-1 flex gap-2 lg:block">
                          <div className="w-1/2 lg:w-full">
                            <label className="text-xs text-slate-500 mb-1 block lg:hidden">Time In</label>
                            <input type="time" value={day.startTime} onChange={(e) => updateDay(actualIndex, 'startTime', e.target.value)} className="w-full border border-slate-300 rounded p-2 lg:p-1.5 text-sm" />
                          </div>
                          <div className="w-1/2 lg:w-full lg:mt-2 lg:hidden">
                            <label className="text-xs text-slate-500 mb-1 block">Time Out</label>
                            <input type="time" value={day.stopTime} onChange={(e) => updateDay(actualIndex, 'stopTime', e.target.value)} className="w-full border border-slate-300 rounded p-2 text-sm" />
                          </div>
                        </div>
                        <div className="col-span-1 hidden lg:block">
                          <input type="time" value={day.stopTime} onChange={(e) => updateDay(actualIndex, 'stopTime', e.target.value)} className="w-full border border-slate-300 rounded p-1.5 text-sm" />
                        </div>
                        <div className="col-span-1 flex items-center justify-center bg-slate-50 border border-slate-200 rounded p-2 lg:p-1.5 text-sm font-bold text-slate-700">
                          <span className="lg:hidden mr-2 text-xs font-normal text-slate-500">Calculated Hours:</span>
                          {day.hours > 0 ? day.hours : '-'}
                        </div>
                        <div className="col-span-3">
                           <label className="text-xs text-slate-500 mb-1 block lg:hidden">Task Details</label>
                           <input type="text" placeholder="Task summary..." value={day.taskDetails} onChange={(e) => updateDay(actualIndex, 'taskDetails', e.target.value)} className="w-full border border-slate-300 rounded p-2 lg:p-1.5 text-sm" />
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
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                       <h4 className="font-bold text-slate-800">Deductions</h4>
                       <button onClick={() => addFin('deductions')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1 px-3 rounded flex items-center gap-1 transition"><Plus size={14}/> Add</button>
                    </div>
                    {formData.deductions.length === 0 && <p className="text-sm text-slate-400 italic">No deductions applied.</p>}
                    {formData.deductions.map((d, i) => (
                       <div key={d.id} className="flex gap-2 mb-2">
                          <input placeholder="Reason" value={d.reason} onChange={(e) => updateFin('deductions', i, 'reason', e.target.value)} className="border border-slate-300 rounded p-1.5 text-sm flex-1" />
                          <input type="number" placeholder="$0.00" value={d.amount} onChange={(e) => updateFin('deductions', i, 'amount', e.target.value)} className="border border-slate-300 rounded p-1.5 text-sm w-24" />
                          <select value={d.assignedTo} onChange={(e) => updateFin('deductions', i, 'assignedTo', e.target.value)} className="border border-slate-300 rounded p-1.5 text-sm w-32 bg-white">
                             <option value="All">All</option>
                             <option value="Charlie">Charlie</option>
                             <option value="Mike & Lee">Mike & Lee</option>
                             <option value="Terry">Terry</option>
                          </select>
                          <button onClick={() => removeFin('deductions', i)} className="text-slate-400 hover:text-red-500 p-1.5"><X size={18}/></button>
                       </div>
                    ))}
                  </div>

                  {/* Bonuses */}
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-3">
                       <h4 className="font-bold text-slate-800">Bonuses</h4>
                       <button onClick={() => addFin('bonuses')} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1 px-3 rounded flex items-center gap-1 transition"><Plus size={14}/> Add</button>
                    </div>
                    {formData.bonuses.length === 0 && <p className="text-sm text-slate-400 italic">No bonuses applied.</p>}
                    {formData.bonuses.map((b, i) => (
                       <div key={b.id} className="flex gap-2 mb-2">
                          <input placeholder="Reason" value={b.reason} onChange={(e) => updateFin('bonuses', i, 'reason', e.target.value)} className="border border-slate-300 rounded p-1.5 text-sm flex-1" />
                          <input type="number" placeholder="$0.00" value={b.amount} onChange={(e) => updateFin('bonuses', i, 'amount', e.target.value)} className="border border-slate-300 rounded p-1.5 text-sm w-24" />
                          <select value={b.assignedTo} onChange={(e) => updateFin('bonuses', i, 'assignedTo', e.target.value)} className="border border-slate-300 rounded p-1.5 text-sm w-32 bg-white">
                             <option value="All">All</option>
                             <option value="Charlie">Charlie</option>
                             <option value="Mike & Lee">Mike & Lee</option>
                             <option value="Terry">Terry</option>
                          </select>
                          <button onClick={() => removeFin('bonuses', i)} className="text-slate-400 hover:text-red-500 p-1.5"><X size={18}/></button>
                       </div>
                    ))}
                  </div>
               </div>

               <div className="lg:col-span-2 bg-slate-800 text-white p-5 rounded-lg shadow-md flex flex-col h-full">
                  <h3 className="font-bold text-lg border-b border-slate-600 pb-2 mb-4">Payment Summary</h3>
                  <div className="space-y-3 flex-1">
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Total Hours</span>
                      <span className="font-mono text-white font-bold">{formTotals.hours}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span>Hourly Rate</span>
                      <div className="flex items-center bg-slate-700 rounded overflow-hidden border border-slate-600">
                         <span className="px-2 text-slate-400 font-mono">$</span>
                         <input type="number" value={formData.rate} onChange={(e) => setFormData({...formData, rate: e.target.value})} className="bg-transparent text-white font-mono p-1 w-16 outline-none" />
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-lg mt-2 pt-2 border-t border-slate-600">
                      <span>Gross Wage</span>
                      <span className="font-mono font-bold">${formTotals.gross.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-red-400 text-sm">
                      <span>Deductions</span>
                      <span className="font-mono">-${formTotals.deds.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-green-400 text-sm">
                      <span>Bonuses</span>
                      <span className="font-mono">+${formTotals.bons.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="mt-4 bg-slate-900 p-4 rounded border border-slate-700">
                     <div className="flex justify-between items-center text-xl font-bold text-white mb-4">
                       <span>Net Pay</span>
                       <span className="font-mono text-blue-400">${formTotals.net.toFixed(2)}</span>
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
                              <option value="Zelle">Zelle</option>
                              <option value="Venmo">Venmo</option>
                           </select>
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
                      const workers = [...new Set((summary.days || []).map(d => d.assignedTo).filter(Boolean))];
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
                             <button onClick={() => editSummary(summary)} className="text-blue-600 font-medium text-sm hover:underline">Edit / Print</button>
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
                       {['Charlie', 'Mike & Lee', 'Terry'].map(person => (
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

      {/* --- PRINT VIEW --- */}
      <div className="hidden print:block w-full text-black bg-white font-sans text-sm p-4 pt-0 mx-auto" style={{ maxWidth: '1000px' }}>
         <div className="flex items-end justify-between border-b-2 border-slate-800 pb-4 mb-6">
             <div className="flex flex-col">
                <img src={settings.companyLogo || 'logo.png'} alt="Company Logo" className="h-20 w-auto object-contain mb-2" onError={(e) => e.target.style.display='none'} />
                {settings.employeeName && <h2 className="text-xl font-bold text-slate-900">{settings.employeeName}</h2>}
                <div className="text-sm text-slate-700 mt-1 flex flex-col gap-0.5">
                   {settings.phone && <span>{settings.phone}</span>}
                   {settings.email && <span>{settings.email}</span>}
                   {settings.website && <span>{settings.website}</span>}
                </div>
             </div>
             <div className="text-right">
                 <h1 className="text-3xl font-black uppercase tracking-widest text-slate-900">Weekly Summary</h1>
                 <p className="text-lg text-slate-700 mt-1">Week Ending: <strong>{formData.weekEndingDate || 'N/A'}</strong></p>
                 {printFilter !== 'All' && (
                   <div className="mt-2 inline-block bg-slate-100 border border-slate-300 px-3 py-1 rounded">
                     <p className="text-md font-bold text-slate-800">Assigned To: {printFilter}</p>
                   </div>
                 )}
             </div>
         </div>

         {renderPrintTable("Weekdays (Mon - Fri)", formData.days.slice(0, 5), printFilter)}
         <div className="h-4"></div>
         {renderPrintTable("Weekend (Sat - Sun)", formData.days.slice(5, 7), printFilter)}

         {(() => {
            const vDays = formData.days.filter(d => printFilter === 'All' || d.assignedTo === printFilter);
            const tHours = vDays.reduce((sum, d) => sum + (Number(d.hours) || 0), 0);
            const tGross = tHours * (Number(formData.rate) || 20);
            
            const vDeds = (formData.deductions || []).filter(d => printFilter === 'All' || d.assignedTo === 'All' || d.assignedTo === printFilter);
            const tDeds = vDeds.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

            const vBons = (formData.bonuses || []).filter(b => printFilter === 'All' || b.assignedTo === 'All' || b.assignedTo === printFilter);
            const tBons = vBons.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);

            const tNet = tGross + tBons - tDeds;

            return (
              <div className="mt-8 pt-4 border-t-2 border-slate-800 break-inside-avoid flex justify-end">
                 <div className="w-96 bg-white p-5 border-2 border-slate-300 rounded shadow-sm">
                    <h3 className="font-bold text-xl mb-4 text-center border-b border-slate-300 pb-2 uppercase tracking-wider">Payment Details</h3>
                    <div className="flex justify-between mb-1 text-slate-700">
                      <span>Total Hours:</span><strong className="text-lg">{tHours}</strong>
                    </div>
                    <div className="flex justify-between mb-1 text-slate-700">
                      <span>Rate:</span><strong>${Number(formData.rate || 20).toFixed(2)} / hr</strong>
                    </div>
                    <div className="flex justify-between mb-4 border-b border-slate-200 pb-3 text-slate-800">
                      <span>Gross Wage:</span><strong className="text-lg">${tGross.toFixed(2)}</strong>
                    </div>
                    
                    {vBons.length > 0 && (
                      <div className="mb-2">
                         <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Bonuses Added</span>
                         {vBons.map(b => (
                           <div key={b.id} className="flex justify-between text-slate-800 text-sm pl-2 mt-1">
                             <span>+ {b.reason || 'Bonus'}</span><span>${Number(b.amount).toFixed(2)}</span>
                           </div>
                         ))}
                      </div>
                    )}

                    {vDeds.length > 0 && (
                      <div className="mb-4 border-b border-slate-200 pb-3">
                         <span className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2 block">Deductions</span>
                         {vDeds.map(d => (
                           <div key={d.id} className="flex justify-between text-slate-800 text-sm pl-2 mt-1">
                             <span>- {d.reason || 'Deduction'}</span><span>${Number(d.amount).toFixed(2)}</span>
                           </div>
                         ))}
                      </div>
                    )}

                    <div className="flex justify-between text-2xl font-black mt-3 pt-2 bg-slate-100 p-2 rounded">
                      <span>Net Pay:</span><span>${tNet.toFixed(2)}</span>
                    </div>

                    {(formData.datePaid || formData.paymentMethod) && (
                      <div className="mt-5 pt-3 border-t border-slate-300 text-sm text-slate-600 grid grid-cols-2 gap-4">
                         <div><strong className="uppercase text-xs tracking-wider block mb-1">Date Paid</strong> {formData.datePaid || 'Pending'}</div>
                         <div><strong className="uppercase text-xs tracking-wider block mb-1">Method</strong> {formData.paymentMethod || '-'}</div>
                      </div>
                    )}
                 </div>
              </div>
            )
         })()}
      </div>

    </div>
  );
}