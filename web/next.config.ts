import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Không cho bundler đóng gói mấy gói này.
     Riêng mssql là bắt buộc: nếu bị bundle, mỗi chunk (server component, route
     handler) sẽ có một bản sao riêng, nên đối tượng kiểu sql.Int tạo ở chunk
     này không được pool ở chunk kia thừa nhận và sinh lỗi
     "Validation failed for parameter … c.type.validate is not a function". */
  serverExternalPackages: ["mssql", "tedious", "exceljs"],
};

export default nextConfig;
