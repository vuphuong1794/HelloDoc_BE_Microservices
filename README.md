<h1>BookStore request flow</h1> 

<a href="https://ibb.co/yYvF5MT"><img src="https://i.ibb.co/KL4x7QZ/nh-ch-p-m-n-h-nh-2024-12-01-151254.png" alt="nh-ch-p-m-n-h-nh-2024-12-01-151254" border="0"></a>

<h1>BookStore Detailed Request Flow</h1>

<a href="https://ibb.co/Km87Pt6"><img src="https://i.ibb.co/52Jv0QT/nh-ch-p-m-n-h-nh-2024-12-01-153613.png" alt="nh-ch-p-m-n-h-nh-2024-12-01-153613" border="0"></a>

-- chạy docker --
docker-compose up -d

command 
nest new .

nest g app bookstore-api-gateway

nest g app users

nest g app books

npm i @nestjs/microservices

nest g module users --project bookstore-api-gateway
nest g service users --project bookstore-api-gateway
nest g controller users --project bookstore-api-gateway

--tạo service books--
nest g resource books --project books 
-chọn microservices, yes

--tạo service trong bookstore-api-gateway--
(module, controller, service)
nest g resource books --project bookstore-api-gateway 
- chọn Rest Api, Yes

--tạo thư viện chung để quản lý--
nest g library contracts

rm -rf libs/contracts/src/*

mkdir libs/contracts/src/books

cp apps/books/src/books/dto* libs/contracts/src/books