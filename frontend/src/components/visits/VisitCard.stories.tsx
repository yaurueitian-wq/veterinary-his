import type { Meta, StoryObj } from "@storybook/react-vite";
import { VisitCardContent } from "./VisitCard";

const meta: Meta<typeof VisitCardContent> = {
  title: "Visits/VisitCard",
  component: VisitCardContent,
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 220 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof VisitCardContent>;

const now = new Date().toISOString();
const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
const twoHoursAgo = new Date(Date.now() - 120 * 60_000).toISOString();

/** 一般候診卡片 */
export const Default: Story = {
  args: {
    visit: {
      id: 1,
      animal_id: 1,
      animal_name: "小花",
      species_name: "犬",
      owner_id: 1,
      owner_name: "王大明",
      attending_vet_id: null,
      attending_vet_name: null,
      status: "registered",
      priority: "normal",
      chief_complaint: "食慾不振，連續兩天未進食",
      registered_at: thirtyMinAgo,
      admitted_at: null,
      completed_at: null,
      status_changed_at: thirtyMinAgo,
      has_pending_lab: false,
    },
  },
};

/** 急診卡片（紅色左邊框 + 警告圖示） */
export const Urgent: Story = {
  args: {
    visit: {
      ...Default.args!.visit!,
      id: 2,
      animal_name: "Lucky",
      priority: "urgent",
      chief_complaint: "車禍後右後肢無法站立，疑似骨折",
      registered_at: now,
      status_changed_at: now,
    },
  },
};

/** 有待結果的檢驗（琥珀色徽章） */
export const PendingLab: Story = {
  args: {
    visit: {
      ...Default.args!.visit!,
      id: 3,
      animal_name: "咪咪",
      species_name: "貓",
      owner_name: "李小美",
      status: "pending_results",
      chief_complaint: "持續嘔吐，已送血液檢查",
      registered_at: twoHoursAgo,
      status_changed_at: thirtyMinAgo,
      has_pending_lab: true,
    },
  },
};

/** 長時間等待（顯示小時） */
export const LongWait: Story = {
  args: {
    visit: {
      ...Default.args!.visit!,
      id: 4,
      animal_name: "大黃",
      species_name: "犬",
      owner_name: "張先生",
      chief_complaint: "例行健康檢查",
      registered_at: twoHoursAgo,
      status_changed_at: twoHoursAgo,
    },
  },
};

/** 資料不完整（動物名稱 / 飼主為 null） */
export const MissingInfo: Story = {
  args: {
    visit: {
      ...Default.args!.visit!,
      id: 5,
      animal_name: null,
      species_name: null,
      owner_name: null,
      chief_complaint: "緊急送入，資料待補",
      registered_at: now,
      status_changed_at: now,
    },
  },
};
