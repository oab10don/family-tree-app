import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  /** 入力一致で確認する文字列（全消去時に「消去」と入力させる等） */
  confirmText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = '確認',
  cancelLabel = 'キャンセル',
  variant = 'default',
  confirmText,
  onConfirm,
  onCancel,
}) => {
  const [inputValue, setInputValue] = useState('');

  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const canConfirm = confirmText ? inputValue === confirmText : true;

  const handleConfirm = () => {
    if (!canConfirm) return;
    setInputValue('');
    onConfirm();
  };

  const handleCancel = () => {
    setInputValue('');
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div
        className="rounded-lg p-6 max-w-sm w-full shadow-xl"
        style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            {isDanger && <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: '#DC2626' }} />}
            <h3 className="text-sm font-bold" style={{ color: '#1E293B' }}>{title}</h3>
          </div>
          <button onClick={handleCancel} style={{ color: '#94A3B8' }} className="hover:opacity-70">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm mb-4 whitespace-pre-wrap" style={{ color: '#475569' }}>{message}</p>

        {confirmText && (
          <div className="mb-4">
            <p className="text-xs mb-2" style={{ color: '#94A3B8' }}>
              確認のため「<span className="font-bold" style={{ color: '#DC2626' }}>{confirmText}</span>」と入力してください
            </p>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={confirmText}
              className="text-sm"
              style={{ borderColor: '#E2E8F0' }}
              autoFocus
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`flex-1 text-white ${!canConfirm ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ backgroundColor: isDanger ? '#DC2626' : '#2563EB' }}
          >
            {confirmLabel}
          </Button>
          <Button
            onClick={handleCancel}
            variant="outline"
            className="flex-1"
            style={{ borderColor: '#E2E8F0', color: '#475569' }}
          >
            {cancelLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
