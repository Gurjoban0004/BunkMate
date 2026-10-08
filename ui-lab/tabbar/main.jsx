import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import PresenceTabBar from '../../src/components/ios/PresenceTabBar.web';
import PaperHeader from '../../src/components/today/PaperHeader';
import TabScrollView from '../../src/components/common/TabScrollView';
import { applyTheme, COLORS } from '../../src/theme/theme';
import useWebViewport from '../../src/hooks/useWebViewport.web';
import './preview.css';
function Preview() {
 useWebViewport();
 const [activeTab, setActiveTab] = useState('Today');
 const [dark, setDark] = useState(false);
 const [admin, setAdmin] = useState(true);
 applyTheme(dark ? 'dark' : 'light', 'editorial');
 return <main style={{background:COLORS.background,color:COLORS.textPrimary}}>
   <SafeAreaInsetsContext.Provider value={{top:0,right:0,bottom:0,left:0}}>
   <TabScrollView testID="layout-scroll" style={{flex:1}} contentContainerStyle={{paddingBottom:24}}>
     <PaperHeader greeting="Navigation," name="Presence" dateString={`${activeTab} · layout preview`} initial="P" onAvatarPress={()=>{}} />
     <div className="preview-content">
       <p>This preview uses the app’s actual header and scrolling components. No attendance data is loaded.</p>
       <div className="controls"><button onClick={()=>setDark(!dark)}>Toggle appearance</button><button onClick={()=>{setAdmin(!admin);if(activeTab==='Admin')setActiveTab('Today');}}>Toggle admin layout</button></div>
       <label>Keyboard check <input placeholder="Tap to type" /></label>
       <div className="scroll-surface"><p>The page continues behind the floating capsule.</p><p>Scroll to check the last item.</p><p className="last-item">End of scrolling content</p></div>
     </div>
   </TabScrollView>
   </SafeAreaInsetsContext.Provider>
   <PresenceTabBar tabs={['Today','Subjects','Insights',...(admin?['Admin']:[])]} activeTab={activeTab} onSelect={setActiveTab}/>
 </main>;
}
createRoot(document.getElementById('root')).render(<Preview/>);
