import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, Download, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function CSVUpload({ school, onUpdate }) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please upload a CSV file');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Extract data with expected schema
      const schema = {
        type: 'object',
        properties: {
          arts_programs: { type: 'array', items: { type: 'string' } },
          sports_programs: { type: 'array', items: { type: 'string' } },
          clubs: { type: 'array', items: { type: 'string' } },
          languages: { type: 'array', items: { type: 'string' } },
          values: { type: 'array', items: { type: 'string' } },
          facilities: { type: 'array', items: { type: 'string' } },
          accreditations: { type: 'array', items: { type: 'string' } }
        }
      };

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: schema
      });

      if (result.status === 'success') {
        setPreview(result.output);
        setUploadResult({ type: 'success', message: 'CSV parsed successfully. Review and confirm to update your profile.' });
      } else {
        setUploadResult({ type: 'error', message: result.details || 'Failed to parse CSV' });
      }
    } catch (error) {
      setUploadResult({ type: 'error', message: error.message });
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!preview) return;

    try {
      await base44.entities.School.update(school.id, preview);
      setUploadResult({ type: 'success', message: 'Profile updated successfully!' });
      setPreview(null);
      onUpdate();
    } catch (error) {
      setUploadResult({ type: 'error', message: 'Failed to update profile' });
    }
  };

  const downloadTemplate = () => {
    const template = `arts_programs,sports_programs,clubs,languages,values,facilities,accreditations
"Drama;Music;Visual Arts","Soccer;Basketball;Swimming","Debate Club;Robotics;Chess","French;Spanish;Mandarin","Excellence;Integrity;Community","Library;Science Labs;Sports Complex","IB;CAIS;NAIS"`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'school-data-template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">CSV Bulk Upload</h2>
        <p className="text-slate-600">Upload program lists, facilities, and other data in bulk</p>
      </div>

      {/* Download Template */}
      <Card className="p-6 mb-6 bg-teal-50 border-teal-200">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-teal-600 flex items-center justify-center">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 mb-1">Need a template?</h3>
            <p className="text-sm text-slate-700">Download our CSV template to get started with the correct format.</p>
          </div>
          <Button onClick={downloadTemplate} variant="outline" className="bg-white">
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </div>
      </Card>

      {/* Upload Area */}
      <Card className="mb-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`p-12 border-2 border-dashed rounded-lg transition-colors ${
            isDragging
              ? 'border-teal-500 bg-teal-50'
              : 'border-slate-300 hover:border-teal-400'
          }`}
        >
          <div className="text-center">
            <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {uploading ? 'Uploading...' : 'Drop your CSV file here'}
            </h3>
            <p className="text-slate-600 mb-4">or</p>
            <label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploading}
              />
              <Button disabled={uploading} className="bg-teal-600 hover:bg-teal-700">
                Browse Files
              </Button>
            </label>
            <p className="text-sm text-slate-500 mt-4">
              CSV files only. Use semicolons (;) to separate multiple items in a cell.
            </p>
          </div>
        </div>
      </Card>

      {/* Upload Result */}
      {uploadResult && (
        <Card className={`p-4 mb-6 ${
          uploadResult.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-3">
            {uploadResult.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-600" />
            )}
            <p className={`text-sm font-medium ${
              uploadResult.type === 'success' ? 'text-green-900' : 'text-red-900'
            }`}>
              {uploadResult.message}
            </p>
          </div>
        </Card>
      )}

      {/* Preview */}
      {preview && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Preview Data</h3>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPreview(null)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmUpload} className="bg-teal-600 hover:bg-teal-700">
                Confirm & Update Profile
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            {Object.entries(preview).map(([key, value]) => (
              <div key={key} className="border-b pb-3">
                <div className="text-sm font-semibold text-slate-700 mb-2 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div className="text-sm text-slate-900">
                  {Array.isArray(value) ? value.join(', ') : value?.toString()}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Instructions */}
      <Card className="p-6 mt-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-3">CSV Format Instructions</h3>
        <ul className="space-y-2 text-sm text-slate-700">
          <li>• Use semicolons (;) to separate multiple items within a cell</li>
          <li>• Example: "Drama;Music;Visual Arts" for arts programs</li>
          <li>• First row must contain column headers matching the template</li>
          <li>• Data should be in the second row</li>
          <li>• Empty cells will not update existing data</li>
          <li>• Special characters in text should be enclosed in quotes</li>
        </ul>
      </Card>
    </div>
  );
}