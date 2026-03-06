import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { useModelAndProvider } from '../../ModelAndProviderContext';
import { useConfig } from '../../ConfigContext';
import { setConfigProvider } from '../../../api';

const MESH_KNOWN_MODELS = [
  { id: 'GLM-4.7-Flash-Q4_K_M', context: 32768, recommended: true },
  { id: 'Qwen3-8B-Q4_K_M', context: 32768, recommended: true },
  { id: 'Qwen2.5-Coder-14B-Instruct-Q4_K_M', context: 32768, recommended: true },
  { id: 'GLM-4-32B-0414-Q4_K_M', context: 32768 },
  { id: 'Qwen2.5-32B-Instruct-Q4_K_M', context: 32768 },
  { id: 'Qwen2.5-14B-Instruct-Q4_K_M', context: 32768 },
  { id: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M', context: 32768 },
  { id: 'Qwen2.5-3B-Instruct-Q4_K_M', context: 32768 },
  { id: 'Qwen3-32B-Q4_K_M', context: 32768 },
  { id: 'Mistral-Small-3.1-24B-Instruct-2503-Q4_K_M', context: 32768 },
  { id: 'DeepSeek-R1-Distill-Qwen-32B-Q4_K_M', context: 32768 },
  { id: 'Hermes-2-Pro-Mistral-7B-Q4_K_M', context: 32768 },
];

const DEFAULT_PORT = 9337;

type MeshStatus = 'unknown' | 'checking' | 'running' | 'stopped';

export const MeshSettings = () => {
  const { currentModel, currentProvider, setProviderAndModel } = useModelAndProvider();
  const { read, upsert } = useConfig();
  const [meshStatus, setMeshStatus] = useState<MeshStatus>('unknown');
  const [port, setPort] = useState<number>(DEFAULT_PORT);
  const [invite, setInvite] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedModelId = currentProvider === 'mesh' ? currentModel : null;

  const checkMeshStatus = useCallback(async () => {
    setMeshStatus('checking');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`http://localhost:${port}/v1/models`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      setMeshStatus(response.ok ? 'running' : 'stopped');
    } catch {
      setMeshStatus('stopped');
    }
  }, [port]);

  useEffect(() => {
    checkMeshStatus();
    const interval = setInterval(checkMeshStatus, 15000);
    return () => clearInterval(interval);
  }, [checkMeshStatus]);

  // Load saved config values
  useEffect(() => {
    (async () => {
      try {
        const savedPort = (await read('MESH_PORT', false)) as string;
        if (savedPort) setPort(parseInt(savedPort, 10) || DEFAULT_PORT);
      } catch {
        // use default
      }
      try {
        const savedInvite = (await read('MESH_INVITE', false)) as string;
        if (savedInvite) setInvite(savedInvite);
      } catch {
        // no invite configured
      }
    })();
  }, [read]);

  const selectModel = async (modelId: string) => {
    setSaving(true);
    try {
      await upsert('MESH_MODEL', modelId, false);
      await upsert('mesh_configured', true, false);
      setProviderAndModel('mesh', modelId);
      await setConfigProvider({
        body: { provider: 'mesh', model: modelId },
        throwOnError: true,
      });
    } catch (error) {
      console.error('Failed to select mesh model:', error);
    } finally {
      setSaving(false);
    }
  };

  const saveAdvancedSettings = async () => {
    setSaving(true);
    try {
      await upsert('MESH_PORT', port, false);
      if (invite.trim()) {
        await upsert('MESH_INVITE', invite.trim(), false);
      }
    } catch (error) {
      console.error('Failed to save mesh settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const statusIndicator = () => {
    switch (meshStatus) {
      case 'running':
        return (
          <span className="flex items-center gap-1.5 text-xs text-green-500">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Running on port {port}
          </span>
        );
      case 'stopped':
        return (
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            Not running — will auto-start when you select a model
          </span>
        );
      case 'checking':
        return (
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Checking...
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-text-default font-medium">Mesh Inference</h3>
          <a
            href="https://github.com/michaelneale/decentralized-inference"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs text-text-muted hover:text-text-default transition-colors"
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            Learn more
          </a>
        </div>
        <p className="text-xs text-text-muted max-w-2xl mt-1">
          Decentralized local LLM inference via mesh-llm. Automatically downloads and runs models
          on your GPU. Pool resources with others using an invite token.
        </p>
        <div className="mt-2">{statusIndicator()}</div>
      </div>

      {/* Model Selection */}
      <div>
        <h4 className="text-sm font-medium text-text-default mb-2">Models</h4>
        <p className="text-xs text-text-muted mb-3">
          Select a model to use with mesh. The model will be automatically downloaded on first use.
        </p>
        <div className="space-y-2">
          {MESH_KNOWN_MODELS.map((model) => {
            const isSelected = selectedModelId === model.id;
            return (
              <div
                key={model.id}
                className={`border rounded-lg p-3 transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-accent-primary bg-accent-primary/5'
                    : 'border-border-subtle bg-background-default hover:border-border-default'
                }`}
                onClick={() => !saving && selectModel(model.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={isSelected}
                      onChange={() => selectModel(model.id)}
                      className="cursor-pointer"
                      disabled={saving}
                    />
                    <span className="text-sm font-medium text-text-default">{model.id}</span>
                    <span className="text-xs text-text-muted">{(model.context / 1024).toFixed(0)}K ctx</span>
                    {model.recommended && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded">
                        Recommended
                      </span>
                    )}
                  </div>
                  {isSelected && meshStatus === 'running' && (
                    <span className="text-xs text-green-500">Active</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="border-t border-border-subtle pt-4">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-text-muted hover:text-text-default transition-colors"
        >
          {showAdvanced ? '▾' : '▸'} Advanced Settings
        </button>

        {showAdvanced && (
          <div className="mt-3 space-y-4">
            <div>
              <label className="text-sm text-text-default block mb-1">Port</label>
              <Input
                type="number"
                value={port}
                onChange={(e) => setPort(parseInt(e.target.value, 10) || DEFAULT_PORT)}
                className="w-32"
                min={1024}
                max={65535}
              />
              <p className="text-xs text-text-muted mt-1">
                Port for mesh-llm API (default: {DEFAULT_PORT})
              </p>
            </div>

            <div>
              <label className="text-sm text-text-default block mb-1">Invite Token</label>
              <Input
                type="text"
                value={invite}
                onChange={(e) => setInvite(e.target.value)}
                placeholder="Optional — paste invite to join a mesh group"
                className="max-w-md"
              />
              <p className="text-xs text-text-muted mt-1">
                Join a decentralized group to pool GPU resources with others.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={saveAdvancedSettings}
              disabled={saving}
            >
              Save Settings
            </Button>
          </div>
        )}
      </div>

      {/* Status / Actions */}
      {meshStatus === 'running' && (
        <div className="border-t border-border-subtle pt-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={checkMeshStatus}
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh Status
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
