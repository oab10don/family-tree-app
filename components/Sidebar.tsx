import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Download, Upload, RotateCcw, FileJson, Users, Search, Undo2, Redo2, UserPlus } from 'lucide-react';
import { DisplaySettings } from '@/types/familyTree';

interface SidebarProps {
  settings: DisplaySettings;
  onSettingsChange: (settings: DisplaySettings) => void;
  onExportJSON: () => void;
  onImportJSON: () => void;
  onExportImage: () => void;
  onReset: () => void;
  onOpenGroupManagement: () => void;
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
  onOpenGroupManagement,
  onAddPerson,
  onSearch,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch(value);
  };

  return (
    <aside className="w-80 bg-gray-100 p-4 border-r border-gray-200 flex flex-col gap-4 overflow-y-auto h-full">
      {/* 検索バー */}
      <div className="space-y-2">
        <Label>検索</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="名前で検索..."
            className="pl-10"
          />
        </div>
      </div>

      <div className="border-t border-gray-300" />

      {/* 新規追加 */}
      <Button
        onClick={onAddPerson}
        className="w-full justify-start bg-primary text-white hover:bg-primary/90"
      >
        <UserPlus className="w-4 h-4 mr-2" />
        新しい人物を追加
      </Button>

      <div className="border-t border-gray-300" />

      {/* Undo/Redo */}
      <div className="flex gap-2">
        <Button
          onClick={onUndo}
          disabled={!canUndo}
          variant="outline"
          className="flex-1"
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
          title="やり直す (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4 mr-2" />
          やり直す
        </Button>
      </div>

      <div className="border-t border-gray-300" />

      {/* グループ管理 */}
      <Button
        onClick={onOpenGroupManagement}
        variant="outline"
        className="w-full justify-start"
      >
        <Users className="w-4 h-4 mr-2" />
        グループ管理
      </Button>

      <div className="border-t border-gray-300" />

      {/* 表示オプション */}
      <div className="space-y-3">
        <h4 className="font-semibold">表示オプション</h4>
        
        <div className="space-y-2 p-2">
          <div className="flex items-center justify-between py-1">
            <Label htmlFor="color-switch">性別で色分け</Label>
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
                id="show-photo"
                checked={settings.showPhoto}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, showPhoto: checked })
                }
              />
              <Label htmlFor="show-photo" className="text-xs">
                写真
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-name"
                checked={settings.showName}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, showName: checked })
                }
              />
              <Label htmlFor="show-name" className="text-xs">
                名前
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-subtitle"
                checked={settings.showSubtitle}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, showSubtitle: checked })
                }
              />
              <Label htmlFor="show-subtitle" className="text-xs">
                サブタイトル
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-birth-death"
                checked={settings.showBirthDeath}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, showBirthDeath: checked })
                }
              />
              <Label htmlFor="show-birth-death" className="text-xs">
                生没年
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-affiliation"
                checked={settings.showAffiliation}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, showAffiliation: checked })
                }
              />
              <Label htmlFor="show-affiliation" className="text-xs">
                所属
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-notes"
                checked={settings.showNotes}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, showNotes: checked })
                }
              />
              <Label htmlFor="show-notes" className="text-xs">
                メモ
              </Label>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-300" />

      {/* 保存 & 読込 */}
      <div className="space-y-2">
        <h4 className="font-semibold pt-2">保存 & 読込</h4>
        
        <Button
          onClick={onExportJSON}
          variant="outline"
          className="w-full justify-start"
        >
          <FileJson className="w-4 h-4 mr-2" />
          JSON形式でエクスポート
        </Button>

        <Button
          onClick={onImportJSON}
          variant="outline"
          className="w-full justify-start"
        >
          <Upload className="w-4 h-4 mr-2" />
          JSON形式でインポート
        </Button>

        <Button
          onClick={onExportImage}
          variant="outline"
          className="w-full justify-start"
        >
          <Download className="w-4 h-4 mr-2" />
          画像としてダウンロード
        </Button>

        <Button
          onClick={onReset}
          variant="ghost"
          className="w-full justify-start"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          全体をリセット
        </Button>
      </div>
    </aside>
  );
};
