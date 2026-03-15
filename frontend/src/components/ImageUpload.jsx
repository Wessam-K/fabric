import { useRef } from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';

export default function ImageUpload({ value, onChange, label, size = 'md', className = '' }) {
  const inputRef = useRef();
  const dims = size === 'sm' ? 'w-16 h-16' : size === 'md' ? 'w-32 h-32' : 'w-48 h-48';

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) onChange(file);
  };

  const imgSrc = value instanceof File ? URL.createObjectURL(value)
    : (typeof value === 'string' && value) ? value : null;

  return (
    <div className={className}>
      {label && <label className="block text-xs text-gray-500 mb-1">{label}</label>}
      <div
        onClick={() => inputRef.current?.click()}
        className={`${dims} rounded-lg border-2 border-dashed border-gray-300 hover:border-[#c9a84c] cursor-pointer flex items-center justify-center overflow-hidden transition-colors bg-gray-50`}
      >
        {imgSrc ? (
          <img src={imgSrc} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="text-center text-gray-400">
            <ImageIcon size={size === 'sm' ? 20 : 32} className="mx-auto mb-1" />
            <span className="text-[10px]">صورة</span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
    </div>
  );
}
