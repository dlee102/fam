import { redirect } from "next/navigation";

/** 예전 경로 호환: /presentation 으로 이동 */
export default function ReportPresentationRedirectPage() {
  redirect("/presentation");
}
