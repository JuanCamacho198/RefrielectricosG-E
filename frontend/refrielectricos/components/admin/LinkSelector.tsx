'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Link as LinkIcon, Box, Tag, ExternalLink } from 'lucide-react';
import { useAdminProducts, useProductMetadata } from '@/hooks/useProducts';

interface LinkSelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

export default function LinkSelector({ value, onChange, label = 'Enlace de Destino', placeholder = 'Buscar producto, categoría o ingresar URL...' }: LinkSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { data: products = [] } = useAdminProducts();
  const { data: metadata } = useProductMetadata();

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (url: string) => {
    onChange(url);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    setSearchTerm(newVal);
    if (!isOpen) setIsOpen(true);
  };

  const suggestions = useMemo(() => {
    const term = searchTerm.toLowerCase();
    
    // Rutas comunes
    const standardLinks = [
      { label: 'Todos los productos', url: '/products', type: 'page', icon: <Box size={14} /> },
      { label: 'Página Principal', url: '/', type: 'page', icon: <LinkIcon size={14} /> },
    ];
    
    // Categories
    const categories = (metadata?.categories || []).map(cat => ({
      label: `Categoría: ${cat}`,
      url: `/products?category=${encodeURIComponent(cat)}`,
      type: 'category',
      icon: <Tag size={14} />
    }));

    // Products
    const productLinks = products.map(p => ({
      label: p.name,
      url: `/products/${p.slug}`,
      type: 'product',
      icon: <Box size={14} />
    }));

    const all = [...standardLinks, ...categories, ...productLinks];

    if (!term) return all.slice(0, 15); // Show some defaults if no term

    return all.filter(item => 
      item.label.toLowerCase().includes(term) || item.url.toLowerCase().includes(term)
    ).slice(0, 20); // Limit to 20 results
  }, [searchTerm, products, metadata]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="block text-sm font-medium leading-6 text-gray-900 dark:text-gray-200 mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          value={isOpen && searchTerm ? searchTerm : value}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="block w-full rounded-md border-0 py-1.5 pl-9 text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-blue-600 bg-white dark:bg-gray-800 sm:text-sm sm:leading-6 px-3 transition-all"
        />
        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-lg max-h-60 flex flex-col">
          <ul className="py-1 overflow-auto custom-scrollbar flex-1">
            {suggestions.length > 0 ? (
              suggestions.map((item, idx) => (
                <li
                  key={idx}
                  className="px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-between group"
                  onClick={() => handleSelect(item.url)}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="text-gray-400 shrink-0">{item.icon}</span>
                    <span className="text-gray-900 dark:text-white truncate" title={item.label}>
                      {item.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0 truncate max-w-[40%]">
                    {item.url}
                  </span>
                </li>
              ))
            ) : (
              <li className="p-4 text-center text-sm text-gray-500">
                No se encontraron sugerencias
              </li>
            )}
            
            {searchTerm && !suggestions.find(s => s.url === searchTerm) && (
               <li
               className="px-4 py-2 text-sm cursor-pointer border-t border-gray-100 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 text-blue-600 dark:text-blue-400"
               onClick={() => handleSelect(searchTerm)}
             >
               <ExternalLink size={14} />
               <span className="truncate">Usar URL: {searchTerm}</span>
             </li>
            )}
          </ul>
        </div>
      )}
      
      {value && !isOpen && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <LinkIcon size={12} className="shrink-0" />
          <span className="truncate max-w-full">Destino: {value}</span>
        </p>
      )}
    </div>
  );
}
