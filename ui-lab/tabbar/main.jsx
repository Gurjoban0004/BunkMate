import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import PresenceTabBar from '../../src/components/ios/PresenceTabBar.web';
import { applyTheme, COLORS } from '../../src/theme/theme';
import useWebViewport from '../../src/hooks/useWebViewport.web';
import './preview.css';
function Preview() {
 useWebViewport();
 const [activeTab, setActiveTab] = useState('Today');
 const [dark, setDark] = useState(false);
 const [admin, setAdmin] = useState(false);
 applyTheme(dark ? 'dark' : 'light', 'editorial');
 return <main style={{background:COLORS.background,color:COLORS.textPrimary}}>
   <h1>Presence</h1><h2>{activeTab}</h2>
   <p>Navigation component preview. No attendance data is loaded here.</p>
   <div className="controls"><button onClick={()=>setDark(!dark)}>Toggle appearance</button><button onClick={()=>{setAdmin(!admin);if(activeTab==='Admin')setActiveTab('Today');}}>Toggle admin layout</button></div>
   <label>Keyboard check <input placeholder="Tap to type" /></label>
   <p className="guide">The floating navigation below uses the same component, icons and theme as the app.</p>
   <PresenceTabBar tabs={['Today','Subjects','Insights',...(admin?['Admin']:[])]} activeTab={activeTab} onSelect={setActiveTab}/>
 </main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
