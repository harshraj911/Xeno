-- DropForeignKey
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_segment_id_fkey";

-- DropForeignKey
ALTER TABLE "communications" DROP CONSTRAINT "communications_campaign_id_fkey";

-- DropForeignKey
ALTER TABLE "communications" DROP CONSTRAINT "communications_customer_id_fkey";

-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "templates" JSONB;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communications" ADD CONSTRAINT "communications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
