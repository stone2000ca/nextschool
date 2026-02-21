import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Save, Eye, Upload, X, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '../../utils';

export default function ProfileEditor({ school, onSave, isSaving }) {
  const [formData, setFormData] = useState(school);
  const [autoSaved, setAutoSaved] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [imagePreview, setImagePreview] = useState({});
  const [verifiedFields, setVerifiedFields] = useState(school?.verifiedFields || {});
  const [sectionRefs, setSectionRefs] = useState({});

  useEffect(() => {
    setFormData(school);
    setVerifiedFields(school?.verifiedFields || {});
  }, [school]);

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    // Mark field as verified when admin manually edits it
    if (!verifiedFields[field]) {
      const updatedVerified = { ...verifiedFields, [field]: true };
      setVerifiedFields(updatedVerified);
      setFormData({ ...formData, [field]: value, verifiedFields: updatedVerified });
    }
  };

  const handleArrayChange = (field, value) => {
    const array = value.split(',').map(item => item.trim()).filter(Boolean);
    handleChange(field, array);
  };

  const handleSave = async () => {
    await onSave(formData);
    setAutoSaved(true);
    setTimeout(() => setAutoSaved(false), 2000);
  };

  const handleImageUpload = async (e, field) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // TASK D: Validate file type and size
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a JPG, PNG, or WebP image');
      return;
    }

    const maxSizes = {
      logoUrl: 500 * 1024, // 500KB
      headerPhotoUrl: 2 * 1024 * 1024, // 2MB
      photoGallery: 2 * 1024 * 1024 // 2MB
    };

    if (file.size > (maxSizes[field] || 2 * 1024 * 1024)) {
      alert(`File too large. Maximum size: ${(maxSizes[field] || 2 * 1024 * 1024) / 1024 / 1024}MB`);
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview({ ...imagePreview, [field]: e.target.result });
    };
    reader.readAsDataURL(file);

    setUploadingImage(true);
    setUploadProgress({ ...uploadProgress, [field]: 0 });

    try {
      // Simulate upload progress
      const interval = setInterval(() => {
        setUploadProgress(prev => ({
          ...prev,
          [field]: Math.min((prev[field] || 0) + 10, 90)
        }));
      }, 100);

      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      clearInterval(interval);
      setUploadProgress({ ...uploadProgress, [field]: 100 });
      
      handleChange(field, file_url);
      
      setTimeout(() => {
        setUploadProgress({ ...uploadProgress, [field]: 0 });
        setImagePreview({ ...imagePreview, [field]: null });
      }, 1000);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAddToArray = (field, newValue) => {
    if (!newValue.trim()) return;
    const current = formData[field] || [];
    handleChange(field, [...current, newValue.trim()]);
  };

  const handleRemoveFromArray = (field, index) => {
    const current = formData[field] || [];
    handleChange(field, current.filter((_, i) => i !== index));
  };

  const TagInput = ({ label, field, placeholder }) => {
    const [inputValue, setInputValue] = useState('');
    const values = formData[field] || [];

    return (
      <div>
        <Label>{label}</Label>
        <div className="flex flex-wrap gap-2 mb-2">
          {values.map((item, index) => (
            <Badge key={index} variant="secondary" className="flex items-center gap-1">
              {item}
              <button
                onClick={() => handleRemoveFromArray(field, index)}
                className="ml-1 hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={placeholder}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddToArray(field, inputValue);
                setInputValue('');
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              handleAddToArray(field, inputValue);
              setInputValue('');
            }}
          >
            Add
          </Button>
        </div>
      </div>
    );
  };

  const isFieldAIEnriched = (field) => {
    return school?.aiEnrichedFields?.includes(field) && !verifiedFields[field];
  };

  const FieldLabel = ({ children, field, required = false }) => (
    <Label className="flex items-center gap-2">
      {children}
      {required && <span className="text-red-500">*</span>}
      {isFieldAIEnriched(field) && !verifiedFields[field] && (
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Auto-filled</span>
      )}
    </Label>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Profile Editor</h2>
          <p className="text-slate-600">Review and update your school's profile information</p>
          {school?.aiEnrichedFields && school.aiEnrichedFields.length > 0 && (
            <p className="text-sm text-blue-600 mt-1">
              {school.aiEnrichedFields.filter(f => !verifiedFields[f]).length} auto-filled fields need verification
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {autoSaved && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle2 className="h-4 w-4" />
              <span>Saved</span>
            </div>
          )}
          <a
            href={createPageUrl(`SchoolProfile?id=${school.id}`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </a>
          <Button 
            onClick={handleSave}
            disabled={isSaving}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* Basic Info */}
        <Card className="p-6" id="basic" ref={(el) => sectionRefs.basic = el}>
          <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel field="name" required>School Name</FieldLabel>
              <Input
                value={formData.name || ''}
                onChange={(e) => handleChange('name', e.target.value)}
                className={isFieldAIEnriched('name') ? 'bg-blue-50 border-blue-200' : ''}
              />
            </div>
            <div>
              <Label>Website</Label>
              <Input
                value={formData.website || ''}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input
                value={formData.address || ''}
                onChange={(e) => handleChange('address', e.target.value)}
              />
            </div>
            <div>
              <Label>City</Label>
              <Input
                value={formData.city || ''}
                onChange={(e) => handleChange('city', e.target.value)}
              />
            </div>
            <div>
              <Label>Province/State</Label>
              <Input
                value={formData.provinceState || ''}
                onChange={(e) => handleChange('provinceState', e.target.value)}
              />
            </div>
            <div>
              <Label>Country</Label>
              <Input
                value={formData.country || ''}
                onChange={(e) => handleChange('country', e.target.value)}
              />
            </div>
            <div>
              <Label>Region</Label>
              <Select value={formData.region} onValueChange={(val) => handleChange('region', val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Canada">Canada</SelectItem>
                  <SelectItem value="US">US</SelectItem>
                  <SelectItem value="Europe">Europe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Grades Served</Label>
              <Input
                value={formData.gradesServed || ''}
                onChange={(e) => handleChange('gradesServed', e.target.value)}
                placeholder="e.g., K-12"
              />
            </div>
            <div>
              <Label>Enrollment</Label>
              <Input
                type="number"
                value={formData.enrollment || ''}
                onChange={(e) => handleChange('enrollment', parseInt(e.target.value))}
              />
            </div>
            <div>
              <Label>Founded</Label>
              <Input
                type="number"
                value={formData.founded || ''}
                onChange={(e) => handleChange('founded', parseInt(e.target.value))}
                placeholder="Year"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={formData.phone || ''}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Academics */}
        <Card className="p-6" id="academics" ref={(el) => sectionRefs.academics = el}>
          <h3 className="text-lg font-semibold mb-4">Academics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Curriculum Type</Label>
              <Select value={formData.curriculumType} onValueChange={(val) => handleChange('curriculumType', val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Traditional">Traditional</SelectItem>
                  <SelectItem value="Montessori">Montessori</SelectItem>
                  <SelectItem value="IB">IB</SelectItem>
                  <SelectItem value="Waldorf">Waldorf</SelectItem>
                  <SelectItem value="AP">AP</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Average Class Size</Label>
              <Input
                type="number"
                value={formData.avgClassSize || ''}
                onChange={(e) => handleChange('avgClassSize', parseInt(e.target.value))}
              />
            </div>
            <div className="col-span-2">
              <Label>Student-Teacher Ratio</Label>
              <Input
                value={formData.studentTeacherRatio || ''}
                onChange={(e) => handleChange('studentTeacherRatio', e.target.value)}
                placeholder="e.g., 12:1"
              />
            </div>
            <div className="col-span-2">
              <TagInput
                label="Specializations"
                field="specializations"
                placeholder="Add specialization (e.g., STEM, Arts)"
              />
            </div>
          </div>
        </Card>

        {/* Financial */}
        <Card className="p-6" id="financial" ref={(el) => sectionRefs.financial = el}>
          <h3 className="text-lg font-semibold mb-4">Financial Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tuition (Annual)</Label>
              <Input
                type="number"
                value={formData.tuition || ''}
                onChange={(e) => handleChange('tuition', parseFloat(e.target.value))}
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={formData.currency} onValueChange={(val) => handleChange('currency', val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 flex items-center justify-between">
              <Label>Financial Aid Available</Label>
              <Switch
                checked={formData.financialAidAvailable || false}
                onCheckedChange={(val) => handleChange('financialAidAvailable', val)}
              />
            </div>
          </div>
        </Card>

        {/* Culture */}
        <Card className="p-6" id="culture" ref={(el) => sectionRefs.culture = el}>
          <h3 className="text-lg font-semibold mb-4">Culture & Philosophy</h3>
          <div className="space-y-4">
            <div>
              <Label>Mission Statement</Label>
              <Textarea
                value={formData.missionStatement || ''}
                onChange={(e) => handleChange('missionStatement', e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label>Teaching Philosophy</Label>
              <Textarea
                value={formData.teachingPhilosophy || ''}
                onChange={(e) => handleChange('teachingPhilosophy', e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <Label>Religious Affiliation</Label>
              <Input
                value={formData.religiousAffiliation || ''}
                onChange={(e) => handleChange('religiousAffiliation', e.target.value)}
              />
            </div>
            <TagInput
              label="Core Values"
              field="values"
              placeholder="Add a value"
            />
          </div>
        </Card>

        {/* Programs */}
        <Card className="p-6" id="programs" ref={(el) => sectionRefs.programs = el}>
          <h3 className="text-lg font-semibold mb-4">Programs & Activities</h3>
          <div className="space-y-4">
            <TagInput
              label="Arts Programs"
              field="artsPrograms"
              placeholder="Add arts program"
            />
            <TagInput
              label="Sports Programs"
              field="sportsPrograms"
              placeholder="Add sports program"
            />
            <TagInput
              label="Clubs"
              field="clubs"
              placeholder="Add club"
            />
            <TagInput
              label="Languages Offered"
              field="languages"
              placeholder="Add language"
            />
            <TagInput
              label="Special Education Programs"
              field="specialEdPrograms"
              placeholder="Add program"
            />
          </div>
        </Card>

        {/* Media */}
        <Card className="p-6" id="media" ref={(el) => sectionRefs.media = el}>
          <h3 className="text-lg font-semibold mb-4">Media & Photos</h3>
          <div className="space-y-6">
            {/* Logo Upload */}
            <div>
              <FieldLabel field="logoUrl">School Logo</FieldLabel>
              <p className="text-xs text-slate-500 mb-2">Square image, 200x200px, max 500KB</p>
              {(formData.logoUrl || imagePreview.logoUrl) && (
                <div className="mb-2">
                  <img 
                    src={imagePreview.logoUrl || formData.logoUrl} 
                    alt="Logo preview" 
                    className="w-24 h-24 object-contain border rounded-lg bg-white p-2"
                  />
                </div>
              )}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={(e) => handleImageUpload(e, 'logoUrl')}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
              />
              {uploadProgress.logoUrl > 0 && uploadProgress.logoUrl < 100 && (
                <div className="mt-2 bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-teal-600 h-full transition-all duration-300"
                    style={{ width: `${uploadProgress.logoUrl}%` }}
                  />
                </div>
              )}
            </div>

            {/* Header Photo Upload */}
            <div>
              <FieldLabel field="headerPhotoUrl">Header Photo</FieldLabel>
              <p className="text-xs text-slate-500 mb-2">16:9 aspect ratio, 1200x675px, max 2MB</p>
              {(formData.headerPhotoUrl || imagePreview.headerPhotoUrl) && (
                <div className="mb-2">
                  <img 
                    src={imagePreview.headerPhotoUrl || formData.headerPhotoUrl} 
                    alt="Header preview" 
                    className="w-full h-48 object-cover rounded-lg"
                  />
                </div>
              )}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={(e) => handleImageUpload(e, 'headerPhotoUrl')}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
              />
              {uploadProgress.headerPhotoUrl > 0 && uploadProgress.headerPhotoUrl < 100 && (
                <div className="mt-2 bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-teal-600 h-full transition-all duration-300"
                    style={{ width: `${uploadProgress.headerPhotoUrl}%` }}
                  />
                </div>
              )}
            </div>

            {/* Gallery Upload */}
            <div>
              <FieldLabel field="photoGallery">Photo Gallery</FieldLabel>
              <p className="text-xs text-slate-500 mb-2">Up to 10 images, max 2MB each</p>
              {formData.photoGallery && formData.photoGallery.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {formData.photoGallery.map((url, idx) => (
                    <div key={idx} className="relative group">
                      <img 
                        src={url} 
                        alt={`Gallery ${idx + 1}`}
                        className="w-full h-24 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => {
                          const updated = formData.photoGallery.filter((_, i) => i !== idx);
                          handleChange('photoGallery', updated);
                        }}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {(!formData.photoGallery || formData.photoGallery.length < 10) && (
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    
                    setUploadingImage(true);
                    try {
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      const currentGallery = formData.photoGallery || [];
                      handleChange('photoGallery', [...currentGallery, file_url]);
                    } catch (error) {
                      console.error('Upload failed:', error);
                    } finally {
                      setUploadingImage(false);
                    }
                  }}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
                />
              )}
            </div>
            
            <div>
              <Label>Hero Image (Legacy)</Label>
              {formData.heroImage && (
                <img src={formData.heroImage} alt="Hero" className="w-full h-48 object-cover rounded-lg mb-2" />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'heroImage')}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
              />
            </div>
            <div>
              <Label>Virtual Tour URL</Label>
              <Input
                value={formData.virtualTourUrl || ''}
                onChange={(e) => handleChange('virtualTourUrl', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
        </Card>

        {/* Admissions */}
        <Card className="p-6" id="admissions" ref={(el) => sectionRefs.admissions = el}>
          <h3 className="text-lg font-semibold mb-4">Admissions</h3>
          <div className="space-y-4">
            <div>
              <Label>Application Deadline</Label>
              <Input
                value={formData.applicationDeadline || ''}
                onChange={(e) => handleChange('applicationDeadline', e.target.value)}
                placeholder="e.g., March 1, 2024"
              />
            </div>
            <div>
              <Label>Acceptance Rate (%)</Label>
              <Input
                type="number"
                value={formData.acceptanceRate || ''}
                onChange={(e) => handleChange('acceptanceRate', parseFloat(e.target.value))}
                min="0"
                max="100"
              />
            </div>
            <TagInput
              label="Admission Requirements"
              field="admissionRequirements"
              placeholder="Add requirement"
            />
            <TagInput
              label="Open House Dates"
              field="openHouseDates"
              placeholder="Add date"
            />
          </div>
        </Card>

        {/* Boarding */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Boarding Information</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Boarding Available</Label>
              <Switch
                checked={formData.boardingAvailable || false}
                onCheckedChange={(val) => handleChange('boardingAvailable', val)}
              />
            </div>
            {formData.boardingAvailable && (
              <div>
                <Label>Boarding Type</Label>
                <Select value={formData.boardingType} onValueChange={(val) => handleChange('boardingType', val)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Boarding</SelectItem>
                    <SelectItem value="weekly">Weekly Boarding</SelectItem>
                    <SelectItem value="day">Day School Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}