import React from 'react';
import { Camera, Image as ImageIcon, Loader2, CheckCircle2, RotateCcw } from 'lucide-react';

const RETURN_OTP_LENGTH = 4;

const ReturnCustomerOtpInput = ({ otp, onChange }) => {
  const inputRefs = React.useRef([]);

  const handleOtpChange = (index, value) => {
    if (value && !/^\d+$/.test(value)) return;
    const next = [...otp];
    next[index] = value.substring(value.length - 1);
    onChange(next);
    if (value && index < RETURN_OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex justify-center gap-2.5">
      {otp.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleOtpChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          className="w-11 h-12 rounded-xl border-2 border-red-200 bg-white text-center text-xl font-black text-gray-900 focus:border-red-500 outline-none shadow-sm"
        />
      ))}
    </div>
  );
};

const ReturnPickupVerification = ({
  billImageUploaded,
  isUploadingBill,
  customerOtpDigits,
  setCustomerOtpDigits,
  handleTakeCameraPhoto,
  handlePickFromGallery,
  cameraInputRef,
  handleBillImageSelect
}) => {
  const customerOtp = customerOtpDigits.join('');
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 space-y-3">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
          <RotateCcw className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-widest text-red-600">
            Return Pickup Verification
          </p>
          <p className="text-xs font-semibold text-gray-700 leading-snug">
            Ask customer for 4-digit handover code
          </p>
        </div>
      </div>

      <ReturnCustomerOtpInput
        otp={customerOtpDigits}
        onChange={setCustomerOtpDigits}
      />

      <div className="flex items-center justify-center gap-3 text-[9px] font-bold uppercase tracking-widest">
        <span className={billImageUploaded ? 'text-green-600' : 'text-gray-400'}>
          {billImageUploaded ? '✓' : '○'} Photo
        </span>
        <span className={customerOtp.length >= RETURN_OTP_LENGTH ? 'text-green-600' : 'text-gray-400'}>
          {customerOtp.length >= RETURN_OTP_LENGTH ? '✓' : '○'} OTP
        </span>
      </div>

      <div className="flex justify-center items-center gap-2 w-full">
        {!billImageUploaded && !isUploadingBill && (
          <>
            <button
              onClick={handleTakeCameraPhoto}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-600 text-white font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all"
            >
              <Camera className="w-4 h-4" />
              <span>Camera</span>
            </button>
            <button
              onClick={handlePickFromGallery}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white text-red-600 border border-red-200 font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all"
            >
              <ImageIcon className="w-4 h-4" />
              <span>Gallery</span>
            </button>
          </>
        )}
        {isUploadingBill && (
          <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-50 text-gray-400 font-bold text-[10px] uppercase tracking-widest">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Uploading...</span>
          </div>
        )}
        {billImageUploaded && (
          <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-100 text-green-700 font-bold text-[10px] uppercase tracking-widest">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Photo Uploaded</span>
          </div>
        )}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleBillImageSelect(e.target.files[0])}
          className="hidden"
        />
      </div>
    </div>
  );
};

const StandardPickupVerification = ({
  billImageUploaded,
  isUploadingBill,
  handleTakeCameraPhoto,
  handlePickFromGallery,
  cameraInputRef,
  handleBillImageSelect
}) => {
  return (
    <div className="space-y-3">
      <div className="flex justify-center items-center gap-3 w-full">
        {!billImageUploaded && !isUploadingBill && (
          <>
            <button
              onClick={handleTakeCameraPhoto}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-gray-900 text-white font-bold text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all"
            >
              <Camera className="w-5 h-5" />
              <span>Camera</span>
            </button>
            <button
              onClick={handlePickFromGallery}
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-red-50 text-red-600 border border-red-100 font-bold text-xs uppercase tracking-widest active:scale-95 transition-all"
            >
              <ImageIcon className="w-5 h-5" />
              <span>Gallery</span>
            </button>
          </>
        )}
        {isUploadingBill && (
          <div className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gray-50 text-gray-400 font-bold text-xs uppercase tracking-widest">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Uploading...</span>
          </div>
        )}
        {billImageUploaded && (
          <div className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-green-100 text-green-700 font-bold text-xs uppercase tracking-widest">
            <CheckCircle2 className="w-4 h-4" />
            <span>Bill Uploaded</span>
          </div>
        )}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleBillImageSelect(e.target.files[0])}
          className="hidden"
        />
      </div>
    </div>
  );
};

export const RenderPickupVerification = (props) => {
  const { isReturnPickup } = props;
  if (isReturnPickup) {
    return <ReturnPickupVerification {...props} />;
  }

  return <StandardPickupVerification {...props} />;
};
