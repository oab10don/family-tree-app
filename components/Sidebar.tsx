import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Download, Upload, FileJson, Search, Undo2, Redo2, UserPlus, Menu, X, Trash2 } from 'lucide-react';
import { DisplaySettings } from '@/types/familyTree';

interface SidebarProps {
  settings: DisplaySettings;
  onSettingsChange: (settings: DisplaySettings) => void;
  onExportJSON: () => void;
  onImportJSON: () => void;
  onExportImage: () => void;
  onReset: () => void;
  onAddPerson: () => void;
  onSearch: (query: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  settings,
  onSettingsChange,
  onExportJSON,
  onImportJSON,
  onExportImage,
  onReset,
  onAddPerson,
  onSearch,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch(value);
  };

  const sidebarContent = (
    <>
      {/* ロゴ/タイトル */}
      <div className="pb-2">
        <h1 className="text-base font-bold" style={{ color: '#1E293B' }}>家系図ツール</h1>
        <p className="text-xs" style={{ color: '#94A3B8' }}>Family Tree Creator</p>
      </div>

      <div style={{ borderTop: '1px solid #E2E8F0' }} />

      {/* 検索 */}
      <div className="space-y-2">
        <Label style={{ color: '#64748B' }}>検索</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: '#94A3B8' }} />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="名前で検索..."
            className="pl-10"
            style={{ borderColor: '#E2E8F0', backgroundColor: '#fff' }}
          />
        </div>
      </div>

      <div style={{ borderTop: '1px solid #E2E8F0' }} />

      {/* 人物追加 */}
      <Button
        onClick={onAddPerson}
        className="w-full justify-start text-white"
        style={{ backgroundColor: '#2563EB' }}
      >
        <UserPlus className="w-4 h-4 mr-2" />
        新しい人物を追加
      </Button>

      <div style={{ borderTop: '1px solid #E2E8F0' }} />

      {/* Undo/Redo */}
      <div className="flex gap-2">
        <Button
          onClick={onUndo}
          disabled={!canUndo}
          variant="outline"
          className="flex-1"
          style={{ borderColor: '#E2E8F0', color: '#475569' }}
          title="元に戻す (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4 mr-2" />
          元に戻す
        </Button>
        <Button
          onClick={onRedo}
          disabled={!canRedo}
          variant="outline"
          className="flex-1"
          style={{ borderColor: '#E2E8F0', color: '#475569' }}
          title="やり直す (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4 mr-2" />
          やり直す
        </Button>
      </div>

      <div style={{ borderTop: '1px solid #E2E8F0' }} />

      {/* 表示オプション */}
      <div className="space-y-3">
        <h4 className="font-semibold text-sm" style={{ color: '#475569' }}>表示オプション</h4>

        <div className="space-y-2 p-2">
          <div className="flex items-center justify-between py-1">
            <Label htmlFor="color-switch" style={{ color: '#64748B' }}>性別で色分け</Label>
            <Switch
              id="color-switch"
              checked={settings.colorByGender}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, colorByGender: checked })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-name"
                checked={settings.showName}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, showName: checked as boolean })
                }
              />
              <Label htmlFor="show-name" className="text-xs" style={{ color: '#64748B' }}>
                名前
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-notes"
                checked={settings.showNotes}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, showNotes: checked as boolean })
                }
              />
              <Label htmlFor="show-notes" className="text-xs" style={{ color: '#64748B' }}>
                メモ
              </Label>
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #E2E8F0' }} />

      {/* 保存 & 読込 */}
      <div className="space-y-2">
        <h4 className="font-semibold pt-2 text-sm" style={{ color: '#475569' }}>保存 & 読込</h4>

        <Button
          onClick={onExportJSON}
          variant="outline"
          className="w-full justify-start"
          style={{ borderColor: '#E2E8F0', color: '#475569' }}
        >
          <FileJson className="w-4 h-4 mr-2" />
          JSON形式でエクスポート
        </Button>

        <Button
          onClick={onImportJSON}
          variant="outline"
          className="w-full justify-start"
          style={{ borderColor: '#E2E8F0', color: '#475569' }}
        >
          <Upload className="w-4 h-4 mr-2" />
          JSON形式でインポート
        </Button>

        <Button
          onClick={onExportImage}
          variant="outline"
          className="w-full justify-start"
          style={{ borderColor: '#E2E8F0', color: '#475569' }}
        >
          <Download className="w-4 h-4 mr-2" />
          画像としてダウンロード
        </Button>

        <Button
          onClick={onReset}
          variant="ghost"
          className="w-full justify-start text-red-500 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          全て消去する
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* モバイル: ハンバーガーボタン */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-md shadow-md"
        style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
      >
        <Menu className="w-6 h-6" style={{ color: '#475569' }} />
      </button>

      {/* モバイル: オーバーレイ */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-30 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* サイドバー本体 */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-72 p-4
          flex flex-col gap-4 overflow-y-auto h-full
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          backgroundColor: '#fff',
          borderRight: '1px solid #E2E8F0',
        }}
      >
        {/* モバイル: 閉じるボタン */}
        <div className="flex justify-end md:hidden">
          <button onClick={() => setIsOpen(false)} style={{ color: '#94A3B8' }}>
            <X className="w-6 h-6" />
          </button>
        </div>

        {sidebarContent}
      </aside>
    </>
  );
};
