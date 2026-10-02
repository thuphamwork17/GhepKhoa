'use client';

import { useState } from 'react';

export default function FilterPage() {
  const [tongHopFile, setTongHopFile] = useState<File | null>(null);
  const [chiTietFile, setChiTietFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tongHop: string, chiTiet: string } | null>(null);

  const handleLoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tongHopFile || !chiTietFile) {
      setError('Vui lòng chọn đủ 2 file: Tổng hợp và Chi tiết');
      return;
    }
    
    setError(null);
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('tongHop', tongHopFile);
    formData.append('chiTiet', chiTietFile);

    try {
      const response = await fetch('/api/filter', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Có lỗi xảy ra');
      }

      const data = await response.json();
      setResult({
        tongHop: data.tongHopBase64,
        chiTiet: data.chiTietBase64
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadFile = (base64: string, filename: string) => {
    const link = document.createElement('a');
    link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 w-full max-w-4xl mx-auto font-sans">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-800">Lọc Báo Cáo Hóa Đơn</h1>
        <p className="text-[13px] text-slate-500 mt-1">
          Upload file bảng kê tổng hợp và bảng kê chi tiết để xử lý.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <form onSubmit={handleLoc} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File Tổng Hợp */}
            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                Bảng kê tổng hợp (Excel)
              </label>
              <input 
                type="file" 
                accept=".xlsx, .xls"
                onChange={(e) => setTongHopFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-800 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590] focus:outline-hidden
                  file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[12px] file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
              />
            </div>

            {/* File Chi Tiết */}
            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">
                Bảng kê chi tiết (Excel)
              </label>
              <input 
                type="file" 
                accept=".xlsx, .xls"
                onChange={(e) => setChiTietFile(e.target.files?.[0] || null)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-800 focus:border-[#0b5590] focus:ring-1 focus:ring-[#0b5590] focus:outline-hidden
                  file:mr-3 file:py-1 file:px-2 file:rounded file:border-0 file:text-[12px] file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
              />
            </div>
          </div>

          {error && (
            <div className="mt-2 text-[13px] text-red-600 flex items-center gap-1.5">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-start">
            <button 
              type="submit" 
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-lg bg-[#0b5590] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#094677] transition shadow-2xs disabled:opacity-60 disabled:cursor-not-allowed min-w-[120px]"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Đang xử lý...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
                  </svg>
                  Lọc dữ liệu
                </>
              )}
            </button>
          </div>
        </form>

        {result && (
          <div className="mt-5 pt-5 border-t border-slate-200">
            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => downloadFile(result.tongHop, '01_BangKeTongHop_Filtered.xlsx')}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
              >
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Tải Tổng Hợp
              </button>
              
              <button 
                onClick={() => downloadFile(result.chiTiet, '01_BangKeChiTiet_Filtered.xlsx')}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition shadow-2xs"
              >
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Tải Chi Tiết
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
