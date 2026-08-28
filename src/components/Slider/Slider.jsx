import React from 'react'
// Import Swiper React components
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Scrollbar, A11y } from 'swiper/modules';
// Import Swiper styles
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/scrollbar';

function Slider() {
  return (
    <div>
        <Swiper
            // install Swiper modules
            modules={[Navigation, Pagination, Scrollbar, A11y]}
            spaceBetween={0}
            slidesPerView={1}
            navigation
            pagination={{ clickable: true }}
            scrollbar={{ draggable: false }}
            >
            <SwiperSlide>
                <img src="./imagenes/1.png" alt="" style={{width:"100%",height: "1000px"}} />
            </SwiperSlide>
            <SwiperSlide>
                <img src="./imagenes/2.png" alt="" style={{width:"100%",height: "1000px"}} />
            </SwiperSlide>
            <SwiperSlide>
                <img src="./imagenes/3.png" alt="" style={{width:"100%",height: "1000px"}} />
            </SwiperSlide>
            <SwiperSlide>
                <img src="./imagenes/4.png" alt="" style={{width:"100%",height: "1000px"}} />
            </SwiperSlide>
        </Swiper>
    </div>
  )
}

export default Slider
