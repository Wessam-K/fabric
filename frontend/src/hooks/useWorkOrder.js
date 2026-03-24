import { useState, useMemo } from 'react';

const emptyFabric = (role = 'main', wastePct = 5) => ({
  fabric_code: '', meters_per_piece: '', waste_pct: role === 'main' ? wastePct : 0, role
});
const emptySize = () => ({ size: '', color_breakdown: '{}' });
const emptyAccessory = () => ({ accessory_code: '', quantity: '', unit_price: '' });

export default function useWorkOrder(initial = {}) {
  const [mainFabrics, setMainFabrics] = useState(initial.mainFabrics || [emptyFabric('main')]);
  const [linings, setLinings] = useState(initial.linings || [emptyFabric('lining')]);
  const [accessories, setAccessories] = useState(initial.accessories || []);
  const [sizes, setSizes] = useState(initial.sizes || [emptySize()]);
  const [masnaiya, setMasnaiya] = useState(initial.masnaiya ?? '');
  const [masrouf, setMasrouf] = useState(initial.masrouf ?? '');
  const [marginPct, setMarginPct] = useState(initial.marginPct ?? '');

  const addFabric = (role = 'main') => {
    if (role === 'lining') setLinings(p => [...p, emptyFabric('lining')]);
    else setMainFabrics(p => [...p, emptyFabric('main')]);
  };
  const removeFabric = (role, idx) => {
    if (role === 'lining') setLinings(p => p.filter((_, i) => i !== idx));
    else setMainFabrics(p => p.filter((_, i) => i !== idx));
  };
  const updateFabric = (role, idx, field, value) => {
    const setter = role === 'lining' ? setLinings : setMainFabrics;
    setter(p => p.map((f, i) => i === idx ? { ...f, [field]: value } : f));
  };

  const addAccessory = () => setAccessories(p => [...p, emptyAccessory()]);
  const removeAccessory = (idx) => setAccessories(p => p.filter((_, i) => i !== idx));
  const updateAccessory = (idx, field, value) => {
    setAccessories(p => p.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const addSize = () => setSizes(p => [...p, emptySize()]);
  const removeSize = (idx) => setSizes(p => p.filter((_, i) => i !== idx));
  const updateSize = (idx, field, value) => {
    setSizes(p => p.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const grandTotal = useMemo(() => {
    return sizes.reduce((sum, s) => {
      try {
        const bd = typeof s.color_breakdown === 'string' ? JSON.parse(s.color_breakdown || '{}') : (s.color_breakdown || {});
        return sum + Object.values(bd).reduce((a, v) => a + (parseInt(v) || 0), 0);
      } catch { return sum; }
    }, 0);
  }, [sizes]);

  const loadFromTemplate = (data) => {
    const mf = (data.fabrics || []).filter(f => f.role === 'main');
    const lf = (data.fabrics || []).filter(f => f.role === 'lining');
    setMainFabrics(mf.length > 0 ? mf : [emptyFabric('main')]);
    setLinings(lf.length > 0 ? lf : [emptyFabric('lining')]);
    setSizes(data.sizes?.length > 0 ? data.sizes : [emptySize()]);
    setAccessories(data.accessories?.length > 0 ? data.accessories : []);
    if (data.masnaiya != null) setMasnaiya(data.masnaiya);
    if (data.masrouf != null) setMasrouf(data.masrouf);
    if (data.margin_pct != null) setMarginPct(data.margin_pct);
  };

  return {
    mainFabrics, linings, accessories, sizes,
    masnaiya, masrouf, marginPct, grandTotal,
    setMainFabrics, setLinings, setAccessories, setSizes,
    setMasnaiya, setMasrouf, setMarginPct,
    addFabric, removeFabric, updateFabric,
    addAccessory, removeAccessory, updateAccessory,
    addSize, removeSize, updateSize,
    loadFromTemplate,
  };
}
